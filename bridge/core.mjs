/**
 * react-specter — local MCP bridge, core (transport-free for testability).
 *
 * One process, two faces:
 *  - MCP over stdio (spawned per-session by the agent via .mcp.json):
 *    tools `get_pending_edit` / `clear_pending_edit`.
 *  - HTTP on 127.0.0.1 for the browser overlay's POST /pending-edit.
 *
 * Every POST does two things:
 *  - queues the selection (latest-wins, in-memory, dies with the session) for
 *    the pull path — /apply-edit → get_pending_edit;
 *  - pushes it into the session as a `claude/channel` event (Claude Code
 *    ≥ 2.1.80 research preview). In sessions started with
 *    `--channels server:specter` Claude starts applying the edit immediately —
 *    no /apply-edit needed. Unsubscribed sessions drop the push silently, so
 *    the queue is always the safety net.
 *
 * stdout is reserved for the MCP protocol — diagnostics go to stderr only
 * (the caller passes a stderr-bound `log`).
 */
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const MAX_BODY_BYTES = 32 * 1024 * 1024; // 32 MB — selections may carry base64 images

const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

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
  /** Image files backing the current selection — replaced latest-wins too. */
  let pendingImagePaths = [];
  let imageSeq = 0;

  // Channel events and MCP tool results carry text, so attached images travel
  // as files: written under node_modules/.cache (inside the project, so no
  // out-of-cwd read prompts; conventionally git-ignored), tmpdir as fallback.
  const imageDir = async () => {
    const preferred = path.join(process.cwd(), 'node_modules', '.cache', 'react-specter', 'images');
    try {
      await mkdir(preferred, { recursive: true });
      return preferred;
    } catch {
      const fallback = path.join(os.tmpdir(), 'react-specter-images');
      await mkdir(fallback, { recursive: true });
      return fallback;
    }
  };

  const cleanupImages = paths => {
    for (const p of paths) unlink(p).catch(() => {});
  };

  /** Write base64 images to disk; returns their absolute paths. */
  const persistImages = async images => {
    if (!Array.isArray(images) || images.length === 0) return [];
    const dir = await imageDir();
    const stamp = `${Date.now()}-${++imageSeq}`;
    const paths = [];
    for (const [i, img] of images.entries()) {
      if (!img || typeof img.dataBase64 !== 'string') continue;
      const ext = IMAGE_EXT[img.mediaType] ?? 'png';
      const file = path.join(dir, `selection-${stamp}-${i + 1}.${ext}`);
      await writeFile(file, Buffer.from(img.dataBase64, 'base64'));
      paths.push(file);
    }
    return paths;
  };

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
      req.on('end', async () => {
        if (res.writableEnded) return;
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
        } catch {
          respond(400, { error: 'invalid JSON' });
          return;
        }
        // Latest-wins: the replaced selection's image files go with it.
        cleanupImages(pendingImagePaths);
        let imagePaths = [];
        try {
          imagePaths = await persistImages(payload?.images);
        } catch (err) {
          log('could not persist attached images:', err.message);
        }
        pendingImagePaths = imagePaths;
        const { images: _images, ...rest } = payload ?? {};
        const stored = { ...rest, imagePaths }; // base64 never sits in memory or tool results
        pendingEdit = { payload: stored, queuedAt: new Date().toISOString() };
        log(
          `queued selection: ${payload?.component ?? '?'} @ ${payload?.sourceFile ?? '?'}` +
            (imagePaths.length ? ` (+${imagePaths.length} image(s))` : '')
        );
        const channelPushed = await pushToChannel(stored);
        respond(200, { ok: true, queued: true, channelPushed });
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

  const mcpServer = new McpServer(
    { name: 'specter', version },
    {
      // Channels research preview (Claude Code ≥ 2.1.80): declaring this lets
      // the bridge push selections straight into a `--channels server:specter`
      // session as <channel source="specter"> events.
      capabilities: { experimental: { 'claude/channel': {} } },
      instructions:
        'Selections from the react-specter browser overlay arrive two ways: queued for pulling via get_pending_edit ' +
        '(the /apply-edit command), and — in sessions started with --channels server:specter — pushed as ' +
        '<channel source="specter"> events. Treat a channel event as a change request to apply right away: follow ' +
        'its embedded procedure, then call clear_pending_edit.',
    }
  );

  const text = obj => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

  /** The channel-event body: a self-sufficient instruction Claude can act on. */
  const serializeChannelInstruction = payload => {
    const p = payload ?? {};
    const scope =
      p.instanceVsShared === 'shared'
        ? 'Change the shared component everywhere it is used.'
        : 'Change ONLY this usage — do not modify a shared component for it.';
    return [
      'react-specter: the developer selected an element in the running dev app and requests this change — apply it now.',
      '',
      `Request: ${p.userRequest ?? ''}`,
      '',
      `Selected element: <${p.tagName ?? '?'}>${p.textContent ? ` ("${p.textContent}")` : ''} in component ${p.component ?? '?'}`,
      `Source anchor (JSX call site): ${p.sourceFile ?? '?'}:${p.sourceLine ?? '?'}`,
      `Scope: ${scope}`,
      `Route: ${p.route ?? '?'}`,
      ...(p.instanceCount > 1 ? [`Note: this call site renders ${p.instanceCount}× on the page.`] : []),
      ...(Array.isArray(p.imagePaths) && p.imagePaths.length
        ? ['', 'Attached screenshot(s) — view them with the Read tool before editing:', ...p.imagePaths.map(f => `- ${f}`)]
        : []),
      '',
      'Procedure: anchor on the file:line, trace the change to where it actually belongs, match the project ' +
        'conventions (styling system, component reuse), state a one-line plan, make the minimal edit, then call ' +
        'clear_pending_edit.',
    ].join('\n');
  };

  /**
   * Push a selection into the session as a channel event. Returns whether the
   * notification was written to the transport — NOT whether the session is
   * subscribed (unsubscribed sessions drop it silently; the queue remains the
   * safety net either way).
   */
  const pushToChannel = async payload => {
    try {
      await mcpServer.server.notification({
        method: 'notifications/claude/channel',
        params: {
          content: serializeChannelInstruction(payload),
          // meta keys: letters/digits/underscores only — others are dropped.
          meta: {
            component: String(payload?.component ?? ''),
            source_file: String(payload?.sourceFile ?? ''),
            source_line: String(payload?.sourceLine ?? ''),
          },
        },
      });
      log('pushed selection into the session channel');
      return true;
    } catch {
      // No MCP transport connected (HTTP-only usage, tests) — queue-only.
      return false;
    }
  };

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
      const result = { pending: true, queuedAt: pendingEdit.queuedAt, ...pendingEdit.payload };
      if (Array.isArray(result.imagePaths) && result.imagePaths.length) {
        result.imageNote = 'The developer attached screenshot(s) — view each imagePath with the Read tool before editing.';
      }
      return text(result);
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
      cleanupImages(pendingImagePaths);
      pendingImagePaths = [];
      return text({ cleared: true });
    }
  );

  return {
    httpServer,
    mcpServer,
    getPending: () => pendingEdit,
    clearPending: () => {
      pendingEdit = null;
      cleanupImages(pendingImagePaths);
      pendingImagePaths = [];
    },
    isHttpActive: () => httpListenerActive,
  };
}
