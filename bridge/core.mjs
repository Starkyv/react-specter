/**
 * react-specter — local MCP bridge, core (transport-free for testability).
 *
 * One process, two faces:
 *  - MCP over stdio (spawned per-session by the agent via .mcp.json):
 *    tools `get_pending_edit` / `clear_pending_edit`.
 *  - HTTP on 127.0.0.1 for the browser overlay's POST /pending-edit.
 *
 * State is a single in-memory "latest selection" — a newer POST replaces an
 * unapplied older one (latest-wins), and dies with the session.
 *
 * stdout is reserved for the MCP protocol — diagnostics go to stderr only
 * (the caller passes a stderr-bound `log`).
 */
import http from 'node:http';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function createBridge({ port = 7331, version = '0.0.0', log = () => {} } = {}) {
  /** @type {{ payload: unknown, queuedAt: string } | null} */
  let pendingEdit = null;
  /** False when another process already owns the HTTP port (second session). */
  let httpListenerActive = false;

  // -------------------------------------------------------------------------
  // HTTP face (overlay-facing)
  // -------------------------------------------------------------------------

  const httpServer = http.createServer((req, res) => {
    const respond = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...CORS_HEADERS });
      res.end(body ? JSON.stringify(body) : undefined);
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      respond(200, { ok: true, pending: pendingEdit !== null });
      return;
    }

    if (req.method === 'POST' && req.url === '/pending-edit') {
      let size = 0;
      const chunks = [];
      req.on('data', chunk => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          respond(413, { error: 'payload too large' });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (res.writableEnded) return;
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          pendingEdit = { payload, queuedAt: new Date().toISOString() }; // latest-wins
          log(`queued selection: ${payload?.component ?? '?'} @ ${payload?.sourceFile ?? '?'}`);
          respond(204);
        } catch {
          respond(400, { error: 'invalid JSON' });
        }
      });
      return;
    }

    respond(404, { error: 'not found' });
  });

  httpServer.on('error', err => {
    if (err.code === 'EADDRINUSE') {
      // Another session's bridge owns the port. Keep the MCP face alive —
      // get_pending_edit explains the situation instead of crashing.
      log(`port ${port} in use — HTTP listener inactive in this session`);
      httpListenerActive = false;
    } else {
      log('HTTP listener error:', err.message);
    }
  });

  httpServer.on('listening', () => {
    httpListenerActive = true;
    const address = httpServer.address();
    log(`HTTP listening on http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}`);
  });

  // -------------------------------------------------------------------------
  // MCP face (agent-facing)
  // -------------------------------------------------------------------------

  const mcpServer = new McpServer({ name: 'specter', version });

  const text = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

  mcpServer.registerTool(
    'get_pending_edit',
    {
      description:
        'Return the most recent element selection + change request posted by the react-specter browser overlay. ' +
        'Returns {"pending": false} if nothing is queued.',
      inputSchema: {},
    },
    async () => {
      if (!httpListenerActive) {
        return text({
          pending: false,
          note: `Another session's bridge owns port ${port} — run /apply-edit from that session, or close it and restart this one.`,
        });
      }
      if (!pendingEdit) {
        return text({
          pending: false,
          note: 'Nothing queued. Select an element in the browser overlay (◎ / Cmd+Shift+E) and press "Send" first.',
        });
      }
      return text({ pending: true, queuedAt: pendingEdit.queuedAt, ...pendingEdit.payload });
    }
  );

  mcpServer.registerTool(
    'clear_pending_edit',
    {
      description: 'Clear the queued react-specter selection. Call after successfully applying an edit. Idempotent.',
      inputSchema: {},
    },
    async () => {
      pendingEdit = null;
      return text({ cleared: true });
    }
  );

  return {
    httpServer,
    mcpServer,
    getPending: () => pendingEdit,
    clearPending: () => {
      pendingEdit = null;
    },
    isHttpActive: () => httpListenerActive,
  };
}
