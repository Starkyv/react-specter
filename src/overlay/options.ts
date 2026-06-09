/**
 * react-specter overlay — options and resolved runtime config.
 *
 * `mountSpecter(options)` resolves options against defaults into a
 * module-level config read by the non-React modules (payload, transport).
 * A single mount per page is the supported model (the overlay is idempotent).
 */
import { DEFAULT_BRIDGE_URL } from '../constants';
import type { SpecterPayload } from './payload';

/**
 * Custom send action: receives the assembled payload; an optionally returned
 * string is shown as the feedback line. Throw to show a failure.
 */
export type SendFn = (payload: SpecterPayload) => string | void | Promise<string | void>;

export interface SpecterOptions {
  /** Hard off-switch. Default true. */
  enabled?: boolean;
  /**
   * The overlay refuses to mount in production builds (NODE_ENV ===
   * 'production') unless this is true — the escape hatch for deliberately
   * stamped internal/dev-environment deploys.
   */
  force?: boolean;
  /**
   * Runtime opt-in gate. When set, the overlay mounts only if this key holds a
   * value in `localStorage` — e.g. `gateKey: 'specter'`, then enable per-browser
   * with `localStorage.setItem('specter', '1')` and reload. Gates the overlay
   * UI only; the build-time `data-specter-*` attributes are unaffected.
   */
  gateKey?: string;
  /**
   * Where the local MCP bridge listens. Default http://127.0.0.1:7331/pending-edit.
   * When set explicitly the bridge is always attempted; by default it is only
   * attempted when the page itself runs on localhost (avoids mixed-content
   * noise on deployed environments).
   */
  bridgeUrl?: string;
  /**
   * Rules text prepended to every "Send to agent" instruction — the place to
   * encode your repo's conventions (styling approach, reuse policy, …).
   */
  rulesPreamble?: string;
  /** Display name of your coding agent in the UI. Default "Claude". */
  agentLabel?: string;
  /**
   * Custom send action. When provided, an extra send button appears alongside
   * the default agent delivery and calls this with the assembled payload —
   * wire it to your own backend, agent, or queue. Return a string to show as
   * feedback (omit for a plain "Sent ✓"); throw to surface a failure.
   */
  onSend?: SendFn;
  /** Label for the `onSend` button. Default "Send". */
  onSendText?: string;
  /**
   * Turn off everything MCP/bridge-related. Default false. When true, the
   * agent "Send to <agentLabel>" button and the bridge online/offline status
   * indicator are hidden, and the bridge health check never runs — for setups
   * that deliver exclusively through a custom `onSend`.
   */
  disableMCP?: boolean;
  /** Cmd/Ctrl+Shift+E shows/hides the prompt box. Set false to disable. Default true. */
  hotkey?: boolean;
}

export interface ResolvedSpecterConfig {
  bridgeUrl: string;
  bridgeUrlExplicit: boolean;
  rulesPreamble: string;
  agentLabel: string;
  hotkey: boolean;
  onSend: SendFn | null;
  onSendText: string;
  disableMCP: boolean;
}

const DEFAULT_RULES_PREAMBLE = [
  'Apply the change request below to this project, following its conventions:',
  "- Match the project's existing styling approach for the touched component (do not introduce a new one).",
  '- Reuse an existing component where one fits before creating new ones.',
  '- If instanceVsShared is "instance", do NOT modify a shared component — change only this usage.',
  "- Before editing, state your plan and the exact files you'll touch, and wait for confirmation.",
].join('\n');

function resolve(options: SpecterOptions): ResolvedSpecterConfig {
  return {
    bridgeUrl: options.bridgeUrl ?? DEFAULT_BRIDGE_URL,
    bridgeUrlExplicit: options.bridgeUrl != null,
    rulesPreamble: options.rulesPreamble ?? DEFAULT_RULES_PREAMBLE,
    agentLabel: options.agentLabel ?? 'Claude',
    hotkey: options.hotkey ?? true,
    onSend: options.onSend ?? null,
    onSendText: options.onSendText ?? 'Send',
    disableMCP: options.disableMCP ?? false,
  };
}

let config: ResolvedSpecterConfig = resolve({});

export function setConfig(options: SpecterOptions): void {
  config = resolve(options);
}

export function getConfig(): ResolvedSpecterConfig {
  return config;
}
