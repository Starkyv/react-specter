/**
 * react-specter overlay — delivery of an assembled selection.
 *
 * Tries the local MCP bridge first; if it isn't running (or isn't reachable
 * from this origin) falls back to the clipboard.
 */
import { getConfig } from './options';
import { serializeInstruction, SpecterPayload } from './payload';

const BRIDGE_TIMEOUT_MS = 800;
const HEALTH_TIMEOUT_MS = 1500;

export type DeliveryResult =
  /** channelPushed: the bridge pushed the selection into the live session (Claude Code channels). */
  | { method: 'bridge'; channelPushed: boolean }
  | { method: 'clipboard' }
  | { method: 'failed'; text: string };

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Non-secure-context / permission fallback.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'specter-offscreen';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * The bridge only exists on a developer's machine. On a deployed (https) env
 * a fetch to http://127.0.0.1 is mixed content — blocked after noise and
 * delay — so off-localhost we don't even try unless the consumer explicitly
 * configured a bridgeUrl.
 */
function bridgeReachable(): boolean {
  if (getConfig().bridgeUrlExplicit) return true;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

/**
 * Is the bridge — and with it the agent session that spawned it — alive?
 * Returns null when the bridge doesn't apply here (off-localhost without an
 * explicit bridgeUrl), so the UI can hide the indicator instead of crying
 * wolf in clipboard-only environments.
 */
export async function checkBridgeHealth(): Promise<boolean | null> {
  if (!bridgeReachable()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const url = new URL('/health', getConfig().bridgeUrl).toString();
    const res = await fetch(url, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function tryBridge(payload: SpecterPayload): Promise<{ delivered: boolean; channelPushed: boolean }> {
  if (!bridgeReachable()) return { delivered: false, channelPushed: false };
  const controller = new AbortController();
  // Image-bearing payloads are megabytes of base64 — give the upload room.
  const timeout = payload.images.length > 0 ? 8000 : BRIDGE_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(getConfig().bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) return { delivered: false, channelPushed: false };
    let channelPushed = false;
    try {
      const body = (await res.json()) as { channelPushed?: boolean };
      channelPushed = body?.channelPushed === true;
    } catch {
      // Older bridge responding 204 with no body — queue-only.
    }
    return { delivered: true, channelPushed };
  } catch {
    return { delivered: false, channelPushed: false };
  } finally {
    clearTimeout(timer);
  }
}

/** Bridge first, clipboard fallback. */
export async function deliver(payload: SpecterPayload): Promise<DeliveryResult> {
  const bridge = await tryBridge(payload);
  if (bridge.delivered) return { method: 'bridge', channelPushed: bridge.channelPushed };
  const text = serializeInstruction(payload);
  if (await copyText(text)) return { method: 'clipboard' };
  return { method: 'failed', text };
}
