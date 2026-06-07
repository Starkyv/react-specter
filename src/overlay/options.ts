/**
 * react-specter overlay — options and resolved runtime config.
 *
 * `mountSpecter(options)` resolves options against defaults into a
 * module-level config read by the non-React modules (payload, transport).
 * A single mount per page is the supported model (the overlay is idempotent).
 */
import { DEFAULT_BRIDGE_URL } from '../constants';
import type { SpecterPayload } from './payload';

export type CreateTicketResult = { ok: true; id: string; url: string } | { ok: false; error: string };

export type CreateTicketFn = (payload: SpecterPayload, title: string) => Promise<CreateTicketResult>;

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
  /** Cmd/Ctrl+Shift+E toggles select mode. Set false to disable. Default true. */
  hotkey?: boolean;
  /**
   * Optional "Create ticket" action. When provided, the panel shows a ticket
   * title input + button and calls this with the assembled payload.
   * See `react-specter/clickup` for a ready-made ClickUp implementation.
   */
  onCreateTicket?: CreateTicketFn;
}

export interface ResolvedSpecterConfig {
  bridgeUrl: string;
  bridgeUrlExplicit: boolean;
  rulesPreamble: string;
  agentLabel: string;
  hotkey: boolean;
  onCreateTicket: CreateTicketFn | null;
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
    onCreateTicket: options.onCreateTicket ?? null,
  };
}

let config: ResolvedSpecterConfig = resolve({});

export function setConfig(options: SpecterOptions): void {
  config = resolve(options);
}

export function getConfig(): ResolvedSpecterConfig {
  return config;
}
