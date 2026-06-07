// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setConfig } from '../src/overlay/options';
import {
  buildPayload,
  countInstances,
  findAnchor,
  getAncestorChain,
  serializeInstruction,
  serializeTicket,
} from '../src/overlay/payload';

// jsdom may lack CSS.escape depending on version.
if (typeof CSS === 'undefined' || typeof CSS.escape !== 'function') {
  (globalThis as Record<string, unknown>).CSS = {
    escape: (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`),
  };
}

function stamped(tag: string, file: string, line: number, component: string): HTMLElement {
  const el = document.createElement(tag);
  el.setAttribute('data-specter-file', file);
  el.setAttribute('data-specter-line', String(line));
  el.setAttribute('data-specter-component', component);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  setConfig({});
});

describe('findAnchor', () => {
  it('walks up to the nearest annotated ancestor', () => {
    const outer = stamped('div', 'src/A.tsx', 3, 'A');
    const plain = document.createElement('span');
    outer.appendChild(plain);
    document.body.appendChild(outer);
    expect(findAnchor(plain)).toBe(outer);
  });

  it('returns null when nothing is annotated', () => {
    const plain = document.createElement('span');
    document.body.appendChild(plain);
    expect(findAnchor(plain)).toBeNull();
  });
});

describe('getAncestorChain', () => {
  it('deduplicates by component name, innermost first', () => {
    const view = stamped('main', 'src/View.tsx', 2, 'View');
    const cardOuter = stamped('article', 'src/Card.tsx', 5, 'Card');
    const cardInner = stamped('div', 'src/Card.tsx', 8, 'Card');
    const leaf = stamped('button', 'src/Card.tsx', 9, 'Card');
    cardInner.appendChild(leaf);
    cardOuter.appendChild(cardInner);
    view.appendChild(cardOuter);
    document.body.appendChild(view);

    const chain = getAncestorChain(leaf);
    expect(chain).toEqual([leaf, view]); // intermediate Card levels deduped
  });
});

describe('countInstances', () => {
  it('counts elements rendered from the same JSX call site', () => {
    for (let i = 0; i < 3; i++) document.body.appendChild(stamped('li', 'src/List.tsx', 7, 'List'));
    document.body.appendChild(stamped('li', 'src/List.tsx', 9, 'List')); // different line
    const anchor = document.querySelector('li') as HTMLElement;
    expect(countInstances(anchor)).toBe(3);
  });
});

describe('serialization', () => {
  function makePayload() {
    const el = stamped('button', 'src/Button.tsx', 12, 'Button');
    el.textContent = 'Save';
    el.className = 'btn primary';
    document.body.appendChild(el);
    return buildPayload(el, { userRequest: 'make it green', instanceVsShared: 'instance' });
  }

  it('builds the full payload shape', () => {
    const payload = makePayload();
    expect(payload).toMatchObject({
      sourceFile: 'src/Button.tsx',
      sourceLine: 12,
      component: 'Button',
      tagName: 'button',
      textContent: 'Save',
      classList: ['btn', 'primary'],
      instanceVsShared: 'instance',
      userRequest: 'make it green',
      instanceCount: 1,
    });
  });

  it('serializeInstruction uses the configured rules preamble', () => {
    setConfig({ rulesPreamble: 'CUSTOM RULES' });
    const text = serializeInstruction(makePayload());
    expect(text.startsWith('CUSTOM RULES')).toBe(true);
    expect(text).toContain('## Request');
    expect(text).toContain('make it green');
    expect(text).toContain('"sourceFile": "src/Button.tsx"');
  });

  it('serializeTicket produces paste-ready markdown', () => {
    const md = serializeTicket(makePayload());
    expect(md).toContain('**Request:** make it green');
    expect(md).toContain('**Source:** `src/Button.tsx:12`');
    expect(md).toContain('**Component:** `Button`');
  });
});
