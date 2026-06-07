/**
 * react-specter overlay — all inspector state and DOM listeners.
 *
 * Modes: idle → selecting (hover/click) → captured (panel open).
 * Listeners are attached only for the active mode and fully detached on exit.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ROOT_ID } from '../constants';
import { getConfig } from './options';
import {
  buildPayload,
  countInstances,
  findAnchor,
  getAncestorChain,
  InstanceVsShared,
  serializeTicket,
} from './payload';
import { copyText, deliver } from './transport';

export type InspectorMode = 'idle' | 'selecting' | 'captured';

function isOverlayNode(target: EventTarget | null): boolean {
  return target instanceof Node && !!document.getElementById(ROOT_ID)?.contains(target);
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
  );
}

export type UseInspectorHookType = ReturnType<typeof useInspector>;

export default function useInspector() {
  const [mode, setMode] = useState<InspectorMode>('idle');
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [chain, setChain] = useState<HTMLElement[]>([]);
  const [chainIndex, setChainIndex] = useState(0);
  const [userRequest, setUserRequest] = useState('');
  const [instanceVsShared, setInstanceVsShared] = useState<InstanceVsShared | null>(null);
  const [feedback, setFeedback] = useState('');
  const [ticketTitle, setTicketTitle] = useState('');
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<{ id: string; url: string } | null>(null);
  // Bumped on reset so an in-flight ticket call can't write into a fresh panel.
  const createSeq = useRef(0);

  const anchor = chain[chainIndex] ?? null;
  const instanceCount = useMemo(() => (anchor ? countInstances(anchor) : 0), [anchor]);

  const reset = useCallback(() => {
    createSeq.current += 1;
    setMode('idle');
    setHoverAnchor(null);
    setChain([]);
    setChainIndex(0);
    setUserRequest('');
    setInstanceVsShared(null);
    setFeedback('');
    setTicketTitle('');
    setIsCreatingTicket(false);
    setCreatedTicket(null);
  }, []);

  const toggle = useCallback(() => {
    setMode(prev => (prev === 'idle' ? 'selecting' : 'idle'));
    setHoverAnchor(null);
    setFeedback('');
  }, []);

  // Global hotkey: Cmd/Ctrl+Shift+E toggles select mode. ESC handled per-mode below.
  useEffect(() => {
    if (!getConfig().hotkey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toggle]);

  // Select mode: hover tracking + click capture. The app must never receive
  // pointer events while selecting, so everything is intercepted in the
  // capture phase (except events on the overlay's own UI).
  useEffect(() => {
    if (mode !== 'selecting') return;

    const onMouseOver = (e: MouseEvent) => {
      setHoverAnchor(isOverlayNode(e.target) ? null : findAnchor(e.target as Element));
    };

    const swallow = (e: Event) => {
      if (isOverlayNode(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    const onClick = (e: MouseEvent) => {
      if (isOverlayNode(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      const found = findAnchor(e.target as Element);
      if (!found) return;
      setChain(getAncestorChain(found));
      setChainIndex(0);
      setInstanceVsShared(null);
      setHoverAnchor(null);
      setMode('captured');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') reset();
    };

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('pointerdown', swallow, true);
    document.addEventListener('mousedown', swallow, true);
    document.addEventListener('mouseup', swallow, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('pointerdown', swallow, true);
      document.removeEventListener('mousedown', swallow, true);
      document.removeEventListener('mouseup', swallow, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mode, reset]);

  // Captured mode: ESC closes; ↑/↓ walk the ancestor breadcrumb (outside inputs).
  useEffect(() => {
    if (mode !== 'captured') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        reset();
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setChainIndex(i => Math.min(i + 1, chain.length - 1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setChainIndex(i => Math.max(i - 1, 0));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, chain.length, reset]);

  const handleSendToAgent = useCallback(async () => {
    if (!anchor || !userRequest.trim()) return;
    const payload = buildPayload(anchor, {
      userRequest: userRequest.trim(),
      instanceVsShared: instanceVsShared ?? 'instance',
    });
    const result = await deliver(payload);
    if (result.method === 'bridge') setFeedback('Sent to bridge ✓ — run /apply-edit in your agent');
    else if (result.method === 'clipboard') setFeedback('Copied ✓ — paste into your agent');
    else setFeedback('Copy failed — clipboard unavailable in this context');
  }, [anchor, userRequest, instanceVsShared]);

  const handleCopyTicket = useCallback(async () => {
    if (!anchor) return;
    const payload = buildPayload(anchor, {
      userRequest: userRequest.trim(),
      instanceVsShared: instanceVsShared ?? 'instance',
    });
    const ok = await copyText(serializeTicket(payload));
    setFeedback(ok ? 'Ticket context copied ✓' : 'Copy failed — clipboard unavailable in this context');
  }, [anchor, userRequest, instanceVsShared]);

  const handleCreateTicket = useCallback(async () => {
    const createTicket = getConfig().onCreateTicket;
    if (!createTicket || !anchor || !ticketTitle.trim() || isCreatingTicket) return;
    const seq = ++createSeq.current;
    setIsCreatingTicket(true);
    setCreatedTicket(null);
    setFeedback('');
    const payload = buildPayload(anchor, {
      userRequest: userRequest.trim(),
      instanceVsShared: instanceVsShared ?? 'instance',
    });
    const result = await createTicket(payload, ticketTitle.trim());
    if (seq !== createSeq.current) return; // panel was reset while in flight
    setIsCreatingTicket(false);
    if (result.ok) setCreatedTicket({ id: result.id, url: result.url });
    else setFeedback(result.error);
  }, [anchor, ticketTitle, isCreatingTicket, userRequest, instanceVsShared]);

  return {
    mode,
    toggle,
    reset,
    hoverAnchor,
    anchor,
    chain,
    chainIndex,
    setChainIndex,
    userRequest,
    setUserRequest,
    instanceCount,
    instanceVsShared,
    setInstanceVsShared,
    feedback,
    ticketTitle,
    setTicketTitle,
    isCreatingTicket,
    createdTicket,
    handleSendToAgent,
    handleCopyTicket,
    handleCreateTicket,
  };
}
