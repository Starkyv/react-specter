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
    expect(res.status).toBe(204);

    res = await fetch(`${baseUrl}/pending-edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(second),
    });
    expect(res.status).toBe(204);

    const pending = bridge.getPending();
    expect(pending?.payload).toEqual(second);
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
    const big = JSON.stringify({ pad: 'x'.repeat(1024 * 1024 + 10) });
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
