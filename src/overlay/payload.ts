/**
 * react-specter overlay — payload assembly & serialization.
 * Pure DOM → data functions; no React, no side effects.
 */
import { COMPONENT_ATTR, FILE_ATTR, LINE_ATTR } from '../constants';
import { getConfig } from './options';

const SNIPPET_MAX = 500;
const TEXT_MAX = 120;
const CHAIN_MAX = 8;

export type InstanceVsShared = 'instance' | 'shared';

export interface SpecterPayload {
  sourceFile: string;
  sourceLine: number;
  component: string;
  elementSnippet: string;
  tagName: string;
  textContent: string;
  classList: string[];
  ancestorComponents: string[];
  instanceVsShared: InstanceVsShared;
  userRequest: string;
  route: string;
  instanceCount: number;
}

/** Nearest annotated element, starting from (and including) `el`. */
export function findAnchor(el: Element | null): HTMLElement | null {
  if (!el) return null;
  const hit = el.closest(`[${FILE_ATTR}]`);
  return hit instanceof HTMLElement ? hit : null;
}

export function componentOf(el: Element): string {
  return el.getAttribute(COMPONENT_ATTR) || '';
}

export function sourceOf(el: Element): { file: string; line: number } {
  return {
    file: el.getAttribute(FILE_ATTR) || '',
    line: Number(el.getAttribute(LINE_ATTR)) || 0,
  };
}

/**
 * Breadcrumb chain: the anchor plus annotated ancestors, deduplicated by
 * component name (one entry per component level, innermost first).
 */
export function getAncestorChain(anchor: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [anchor];
  let lastComponent = componentOf(anchor);
  let current = anchor.parentElement;
  while (current && chain.length < CHAIN_MAX) {
    if (current.hasAttribute(FILE_ATTR) && componentOf(current) !== lastComponent) {
      chain.push(current);
      lastComponent = componentOf(current);
    }
    current = current.parentElement;
  }
  return chain;
}

/** Component names from the anchor outward, deduplicated. */
export function getAncestorComponents(anchor: HTMLElement): string[] {
  return getAncestorChain(anchor).map(componentOf).filter(Boolean);
}

/**
 * How many times the anchor's exact JSX call site (file + line) is currently
 * rendered — the precise "this element appears N times" signal (mapped rows,
 * repeated cards). Deliberately NOT a component count: one component instance
 * contains many stamped elements.
 */
export function countInstances(anchor: HTMLElement): number {
  const { file, line } = sourceOf(anchor);
  if (!file) return 1;
  return document.querySelectorAll(`[${FILE_ATTR}="${CSS.escape(file)}"][${LINE_ATTR}="${line}"]`).length;
}

/** SVG-safe class list (SVG `className` is an SVGAnimatedString). */
function safeClassList(el: Element): string[] {
  const raw = el.getAttribute('class') || '';
  return raw.split(/\s+/).filter(Boolean);
}

function truncateSnippet(html: string): string {
  if (html.length <= SNIPPET_MAX) return html;
  const cut = html.slice(0, SNIPPET_MAX);
  // Avoid cutting mid-tag where we can.
  const lastOpen = cut.lastIndexOf('<');
  const lastClose = cut.lastIndexOf('>');
  return `${lastOpen > lastClose ? cut.slice(0, lastOpen) : cut}…`;
}

export function buildPayload(
  anchor: HTMLElement,
  opts: { userRequest: string; instanceVsShared: InstanceVsShared }
): SpecterPayload {
  const { file, line } = sourceOf(anchor);
  return {
    sourceFile: file,
    sourceLine: line,
    component: componentOf(anchor),
    elementSnippet: truncateSnippet(anchor.outerHTML),
    tagName: anchor.tagName.toLowerCase(),
    textContent: (anchor.textContent || '').replace(/\s+/g, ' ').trim().slice(0, TEXT_MAX),
    classList: safeClassList(anchor),
    ancestorComponents: getAncestorComponents(anchor),
    instanceVsShared: opts.instanceVsShared,
    userRequest: opts.userRequest,
    route: `${window.location.pathname}${window.location.search}`,
    instanceCount: countInstances(anchor),
  };
}

/**
 * The full instruction delivered to the agent ("Send to agent"): the
 * configured rules preamble keeps the clipboard path self-sufficient; the
 * /apply-edit command (bridge path) carries the fuller procedure.
 */
export function serializeInstruction(payload: SpecterPayload): string {
  return [
    getConfig().rulesPreamble,
    '',
    '## Request',
    payload.userRequest,
    '',
    '## Selected element context',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
    '',
  ].join('\n');
}

/** Paste-ready markdown for a ticket ("Copy for ticket"). */
export function serializeTicket(payload: SpecterPayload): string {
  const lines = [
    ...(payload.userRequest ? [`**Request:** ${payload.userRequest}`, ''] : []),
    `**Element:** \`${payload.tagName}\`${payload.textContent ? ` — "${payload.textContent}"` : ''}`,
    `**Component:** \`${payload.component}\`${
      payload.instanceCount > 1 ? ` (one of ${payload.instanceCount} instances on page)` : ''
    }`,
    `**Source:** \`${payload.sourceFile}:${payload.sourceLine}\``,
    `**Route:** \`${payload.route}\``,
    `**Ancestors:** ${payload.ancestorComponents.join(' → ')}`,
  ];
  return lines.join('\n');
}
