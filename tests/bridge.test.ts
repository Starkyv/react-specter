import { existsSync, readFileSync } from 'node:fs';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createBridge, type Bridge } from '../bridge/core.mjs';

let bridge: Bridge;
let baseUrl: string;

beforeAll(async () => {
  bridge = createBridge({ port: 0 });
  await new Promise<void>(resolve => {
    bridge.httpServer.listen(0, '127.0.0.1', () => resolve());
  });
  const address = bridge.httpServer.address();
  if (typeof address !== 'object' || !address) throw new Error('no address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise(resolve => bridge.httpServer.close(resolve));
});

describe('bridge HTTP face', () => {
  it('reports health', async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pending: false });
    expect(bridge.isHttpActive()).toBe(true);
  });

  it('queues a posted selection (latest-wins)', async () => {
    const first = { component: 'Button', sourceFile: 'src/Button.tsx', userRequest: 'older' };
    const second = { component: 'Card', sourceFile: 'src/Card.tsx', userRequest: 'newer' };

    let res = await fetch(`${baseUrl}/pending-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(first),
    });
    expect(res.status).toBe(200);
    // No MCP transport connected in this suite — queued, but no channel push.
    expect(await res.json()).toEqual({ ok: true, queued: true, channelPushed: false });

    res = await fetch(`${baseUrl}/pending-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(second),
    });
    expect(res.status).toBe(200);

    const pending = bridge.getPending();
    expect(pending?.payload).toEqual({ ...second, imagePaths: [] });
    expect(typeof pending?.queuedAt).toBe('string');

    bridge.clearPending();
    expect(bridge.getPending()).toBeNull();
  });

  it('rejects invalid JSON with 400', async () => {
    const res = await fetch(`${baseUrl}/pending-edit`, { method: 'POST', body: 'not json {' });
    expect(res.status).toBe(400);
    expect(bridge.getPending()).toBeNull();
  });

  it('rejects oversized payloads', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(32 * 1024 * 1024 + 10) });
    // The server may reset the connection mid-upload after responding 413 —
    // accept either observable outcome, but the queue must stay clean.
    try {
      const res = await fetch(`${baseUrl}/pending-edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: big,
      });
      expect(res.status).toBe(413);
    } catch {
      // connection reset — also fine
    }
    expect(bridge.getPending()).toBeNull();
  });

  it('answers OPTIONS preflight with CORS headers', async () => {
    const res = await fetch(`${baseUrl}/pending-edit`, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('404s unknown routes', async () => {
    const res = await fetch(`${baseUrl}/nope`);
    expect(res.status).toBe(404);
  });
});

describe('bridge image handling', () => {
  it('persists attached images to disk, references paths, and cleans up on clear', async () => {
    const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await fetch(`${baseUrl}/pending-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: 'Hero',
        sourceFile: 'src/Hero.tsx',
        sourceLine: 5,
        userRequest: 'match this mock',
        images: [{ name: 'mock.png', mediaType: 'image/png', dataBase64: pngBytes.toString('base64') }],
      }),
    });
    expect(res.status).toBe(200);

    const stored = bridge.getPending()?.payload as { images?: unknown; imagePaths?: string[] };
    expect(stored.images).toBeUndefined(); // base64 never kept around
    expect(stored.imagePaths).toHaveLength(1);
    const file = stored.imagePaths![0];
    expect(file.endsWith('.png')).toBe(true);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file)).toEqual(pngBytes); // round-trips byte-exact

    bridge.clearPending();
    // unlink is fire-and-forget — give it a beat.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(existsSync(file)).toBe(false);
  });
});

describe('bridge channel push (Claude Code channels)', () => {
  it('pushes a posted selection into the session as a channel event', async () => {
    const channelBridge = createBridge({ port: 0 });
    await new Promise<void>(resolve => {
      channelBridge.httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const address = channelBridge.httpServer.address();
    if (typeof address !== 'object' || !address) throw new Error('no address');
    const url = `http://127.0.0.1:${address.port}`;

    // Stand in for the Claude Code session: an MCP client on a linked
    // in-memory transport, recording every unsolicited notification.
    const notifications: Array<{ method: string; params?: { content?: string; meta?: Record<string, string> } }> = [];
    const client = new Client({ name: 'test-session', version: '0.0.0' });
    client.fallbackNotificationHandler = async notification => {
      notifications.push(notification as (typeof notifications)[number]);
    };
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), channelBridge.mcpServer.connect(serverTransport)]);

    const payload = {
      component: 'Counter',
      sourceFile: 'src/components/Counter.tsx',
      sourceLine: 8,
      tagName: 'button',
      textContent: 'count is 0',
      userRequest: 'make this button green',
      instanceVsShared: 'instance',
      route: '/',
      instanceCount: 1,
    };
    const res = await fetch(`${url}/pending-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: true, channelPushed: true });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].method).toBe('notifications/claude/channel');
    const { content, meta } = notifications[0].params ?? {};
    expect(content).toContain('make this button green');
    expect(content).toContain('src/components/Counter.tsx:8');
    expect(content).toContain('clear_pending_edit');
    expect(content).toContain('Change ONLY this usage');
    expect(meta).toEqual({ component: 'Counter', source_file: 'src/components/Counter.tsx', source_line: '8' });

    // The pull path still has the selection — the queue is the safety net for
    // sessions not started with --channels.
    expect(channelBridge.getPending()?.payload).toEqual({ ...payload, imagePaths: [] });

    await client.close();
    await new Promise(resolve => channelBridge.httpServer.close(resolve));
  });
});
