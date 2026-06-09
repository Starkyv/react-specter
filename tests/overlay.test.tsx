// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mountSpecter, unmountSpecter, type SpecterPayload } from '../src/overlay';

async function waitFor(cond: () => unknown, ms = 2000): Promise<void> {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > ms) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

afterEach(() => {
  unmountSpecter();
  vi.unstubAllGlobals();
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

  it('gateKey: mounts only when the localStorage key holds a value', () => {
    localStorage.removeItem('specter-gate');

    // No key → no mount.
    mountSpecter({ gateKey: 'specter-gate' });
    expect(document.getElementById('specter-root')).toBeNull();

    // Key set → mounts.
    localStorage.setItem('specter-gate', '1');
    mountSpecter({ gateKey: 'specter-gate' });
    expect(document.getElementById('specter-root')).toBeTruthy();

    localStorage.removeItem('specter-gate');
  });

  it('toggle opens the prompt box; its ✕ hides it and brings the toggle back', async () => {
    mountSpecter();
    await waitFor(() => document.querySelector('.specter-toggle'));
    // The box is mounted but hidden until opened.
    expect(document.querySelector('.specter-promptbox.is-hidden')).toBeTruthy();

    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));
    expect(document.querySelector('.specter-toggle')).toBeNull(); // launcher hidden while open
    expect(document.querySelector('.specter-inspect')).toBeTruthy();
    expect(document.querySelector('.specter-request')).toBeTruthy();

    (document.querySelector('.specter-close') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox.is-hidden'));
    await waitFor(() => document.querySelector('.specter-toggle'));
  });

  it('shows the agent status dot: offline when the bridge is unreachable, online when healthy', async () => {
    // Bridge down: every health probe fails.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('connection refused'))));
    mountSpecter();
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-status.is-offline'));
    expect(document.querySelector('.specter-status')?.textContent).toContain('Offline');

    // Bridge comes up: the indicator flips on a later poll/send. Re-open to
    // trigger an immediate re-check instead of waiting out the interval.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true, pending: false }), { status: 200 })))
    );
    (document.querySelector('.specter-close') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-status.is-online'));
    expect(document.querySelector('.specter-status')?.textContent).toContain('Online');
  });

  it('a custom onSend adds its own labelled button that fires the callback', async () => {
    // A stamped app element to capture.
    const target = document.createElement('button');
    target.setAttribute('data-specter-file', 'src/Demo.tsx');
    target.setAttribute('data-specter-line', '3');
    target.setAttribute('data-specter-component', 'Demo');
    target.textContent = 'hello';
    document.body.appendChild(target);

    const sent: SpecterPayload[] = [];
    mountSpecter({
      onSendText: 'Queue it',
      onSend: payload => {
        sent.push(payload);
        return 'Queued in MyTracker ✓';
      },
    });

    // Open the box, arm inspect, capture the element.
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));

    // The agent send button is always present; the custom button only when onSend is set.
    const customSend = document.querySelector('.specter-custom-send') as HTMLButtonElement;
    expect(customSend).toBeTruthy();
    expect(document.querySelector('.specter-send')).toBeTruthy(); // default agent delivery stays
    expect(customSend.textContent).toBe('Queue it'); // onSendText override

    (document.querySelector('.specter-inspect') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-inspect.is-active'));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => document.querySelector('.specter-breadcrumb'));

    // Type a request and trigger the custom button.
    const textarea = document.querySelector('.specter-request') as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setValue.call(textarea, 'rename it');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !(document.querySelector('.specter-custom-send') as HTMLButtonElement).disabled);
    (document.querySelector('.specter-custom-send') as HTMLElement).click();

    await waitFor(() => sent.length === 1);
    expect(sent[0]).toMatchObject({
      component: 'Demo',
      sourceFile: 'src/Demo.tsx',
      sourceLine: 3,
      tagName: 'button',
      userRequest: 'rename it',
    });
    await waitFor(() => document.querySelector('.specter-feedback')?.textContent === 'Queued in MyTracker ✓');

    target.remove();
  });

  it('defaults the onSend button label to "Send"', async () => {
    mountSpecter({ onSend: () => {} });
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-custom-send'));
    expect(document.querySelector('.specter-custom-send')?.textContent).toBe('Send');
  });

  it('shows no custom-send button when onSend is not configured', async () => {
    mountSpecter();
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));
    expect(document.querySelector('.specter-custom-send')).toBeNull();
    expect(document.querySelector('.specter-send')).toBeTruthy();
  });

  it('disableMCP hides the agent send button and status indicator, keeps the custom send', async () => {
    // fetch must never be called for a health probe when MCP is disabled.
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchSpy);

    mountSpecter({ disableMCP: true, onSend: () => {} });
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));

    expect(document.querySelector('.specter-send')).toBeNull(); // agent delivery hidden
    expect(document.querySelector('.specter-status')).toBeNull(); // online/offline hidden
    expect(document.querySelector('.specter-custom-send')).toBeTruthy(); // custom action stays

    // Give the (skipped) poll interval a chance — it must not have fired.
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('attached images show as thumbnails and travel in the payload', async () => {
    const target = document.createElement('button');
    target.setAttribute('data-specter-file', 'src/Demo.tsx');
    target.setAttribute('data-specter-line', '3');
    target.setAttribute('data-specter-component', 'Demo');
    document.body.appendChild(target);

    const sent: SpecterPayload[] = [];
    mountSpecter({ onSend: payload => void sent.push(payload) });

    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));
    (document.querySelector('.specter-inspect') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-inspect.is-active'));
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => document.querySelector('.specter-breadcrumb'));

    // Attach an image through the hidden file input.
    const attach = () => {
      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'mock.png', { type: 'image/png' });
      const input = document.querySelector('.specter-file-input') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
    attach();
    await waitFor(() => document.querySelector('.specter-thumb img'));
    expect((document.querySelector('.specter-thumb img') as HTMLImageElement).src).toContain('data:image/png;base64,');

    // The remove button drops the thumbnail.
    (document.querySelector('.specter-thumb-remove') as HTMLElement).click();
    await waitFor(() => !document.querySelector('.specter-thumb'));
    attach();
    await waitFor(() => document.querySelector('.specter-thumb img'));

    const textarea = document.querySelector('.specter-request') as HTMLTextAreaElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setValue.call(textarea, 'match the mock');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => !(document.querySelector('.specter-custom-send') as HTMLButtonElement).disabled);
    (document.querySelector('.specter-custom-send') as HTMLElement).click();

    await waitFor(() => sent.length === 1);
    expect(sent[0].images).toHaveLength(1);
    expect(sent[0].images[0]).toMatchObject({ name: 'mock.png', mediaType: 'image/png' });
    expect(sent[0].images[0].dataBase64.length).toBeGreaterThan(0);

    // Sending clears the form — the thumbnail strip and draft go with it.
    await waitFor(() => !document.querySelector('.specter-thumb'));
    expect((document.querySelector('.specter-request') as HTMLTextAreaElement).value).toBe('');

    target.remove();
  });

  it('hiding the box preserves the draft request', async () => {
    mountSpecter();
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));

    const textarea = document.querySelector('.specter-request') as HTMLTextAreaElement;
    // Drive React's onChange through the native value setter.
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
    setValue.call(textarea, 'make it green');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => textarea.value === 'make it green');

    (document.querySelector('.specter-close') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-toggle'));
    (document.querySelector('.specter-toggle') as HTMLElement).click();
    await waitFor(() => document.querySelector('.specter-promptbox:not(.is-hidden)'));
    expect((document.querySelector('.specter-request') as HTMLTextAreaElement).value).toBe('make it green');
  });
});
