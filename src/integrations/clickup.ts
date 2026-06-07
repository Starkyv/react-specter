/**
 * react-specter — optional ClickUp ticket integration.
 *
 * Returns an `onCreateTicket` implementation for `mountSpecter`:
 *
 *   import { createClickUpTicket } from 'react-specter/clickup';
 *   mountSpecter({
 *     onCreateTicket: createClickUpTicket({
 *       token: import.meta.env.VITE_CLICKUP_TOKEN,   // your bundler's env mechanism
 *       listId: import.meta.env.VITE_CLICKUP_LIST_ID,
 *     }),
 *   });
 *
 * Browser-direct by design: testers on a deployed dev environment have no
 * localhost bridge, so the API call must come from the page. Use a
 * low-privilege bot token scoped to a triage list, and never define these
 * variables in customer-facing builds.
 */
import type { CreateTicketFn, CreateTicketResult } from '../overlay/options';
import { serializeTicket, type SpecterPayload } from '../overlay/payload';

export interface ClickUpTicketOptions {
  /** ClickUp API token (use a low-privilege bot token). */
  token: string | undefined;
  /** The list new tickets land in. */
  listId: string | undefined;
  /** Tag applied to created tasks. Default 'specter'. */
  tag?: string;
  timeoutMs?: number;
}

export function createClickUpTicket(options: ClickUpTicketOptions): CreateTicketFn {
  const { token, listId, tag = 'specter', timeoutMs = 10_000 } = options;

  return async (payload: SpecterPayload, title: string): Promise<CreateTicketResult> => {
    if (!token || !listId) return { ok: false, error: 'ClickUp is not configured (token / listId missing)' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // `markdown_content` takes precedence over `description`; `tags` is a
      // string array. Error strings never include the token.
      const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: title,
          markdown_content: serializeTicket(payload),
          tags: [tag],
        }),
        signal: controller.signal,
      });
      if (res.status === 401) return { ok: false, error: 'ClickUp rejected the token' };
      if (res.status === 404) return { ok: false, error: 'List not found — check listId' };
      if (!res.ok) return { ok: false, error: `ClickUp error ${res.status}` };
      const task = (await res.json()) as { id?: string; url?: string };
      if (!task.id) return { ok: false, error: 'Unexpected ClickUp response' };
      return { ok: true, id: task.id, url: task.url || `https://app.clickup.com/t/${task.id}` };
    } catch {
      return { ok: false, error: 'Could not reach ClickUp' };
    } finally {
      clearTimeout(timer);
    }
  };
}
