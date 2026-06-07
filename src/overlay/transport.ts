/**
 * react-specter overlay — delivery of an assembled selection.
 *
 * Tries the local MCP bridge first; if it isn't running (or isn't reachable
 * from this origin) falls back to the clipboard.
 */
import { getConfig } from './options';
import { serializeInstruction, SpecterPayload } from './payload';

const BRIDGE_TIMEOUT_MS = 800;

export type DeliveryResult = { method: 'bridge' } | { method: 'clipboard' } | { method: 'failed'; text: string };

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

async function tryBridge(payload: SpecterPayload): Promise<boolean> {
  if (!bridgeReachable()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  try {
    const res = await fetch(getConfig().bridgeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Bridge first, clipboard fallback. */
export async function deliver(payload: SpecterPayload): Promise<DeliveryResult> {
  if (await tryBridge(payload)) return { method: 'bridge' };
  const text = serializeInstruction(payload);
  if (await copyText(text)) return { method: 'clipboard' };
  return { method: 'failed', text };
}
