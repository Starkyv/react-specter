// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';

import { mountSpecter, unmountSpecter } from '../src/overlay';

async function waitFor(cond: () => unknown, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

afterEach(() => {
  unmountSpecter();
});

describe('mountSpecter', () => {
  it('mounts its own root, injects styles, renders the toggle', async () => {
    mountSpecter();
    expect(document.getElementById('specter-root')).toBeTruthy();
    expect(document.getElementById('specter-styles')).toBeTruthy();
    await waitFor(() => document.querySelector('.specter-toggle'));
  });

  it('is idempotent across repeated mounts (HMR/strict mode)', async () => {
    mountSpecter();
    mountSpecter();
    expect(document.querySelectorAll('#specter-root')).toHaveLength(1);
    expect(document.querySelectorAll('#specter-styles')).toHaveLength(1);
  });

  it('unmount removes everything it added', async () => {
    const unmount = mountSpecter();
    await waitFor(() => document.querySelector('.specter-toggle'));
    unmount();
    expect(document.getElementById('specter-root')).toBeNull();
    expect(document.getElementById('specter-styles')).toBeNull();
  });

  it('respects enabled: false', () => {
    mountSpecter({ enabled: false });
    expect(document.getElementById('specter-root')).toBeNull();
  });
});
