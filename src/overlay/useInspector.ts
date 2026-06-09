/**
 * react-specter overlay — all inspector state and DOM listeners.
 *
 * The prompt box is the hub: the ◎ button / hotkey opens it, its Inspect
 * button arms element selection (hover/click), and the captured element fills
 * the box's context row. Hiding the box (✕ / Esc) preserves the draft request
 * and the selection; listeners are attached only while needed.
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
  SpecterImage,
} from './payload';
import { checkBridgeHealth, copyText, deliver } from './transport';

const HEALTH_POLL_MS = 5000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function readImage(file: File): Promise<SpecterImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      resolve({
        name: file.name || 'pasted-image',
        mediaType: file.type,
        dataBase64: dataUrl.slice(dataUrl.indexOf(',') + 1),
      });
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const [chain, setChain] = useState<HTMLElement[]>([]);
  const [chainIndex, setChainIndex] = useState(0);
  const [userRequest, setUserRequest] = useState('');
  const [images, setImages] = useState<SpecterImage[]>([]);
  // Defaults to 'shared' — editing the component everywhere is the common case.
  const [instanceVsShared, setInstanceVsShared] = useState<InstanceVsShared>('shared');
  const [feedback, setFeedback] = useState('');
  const [isSending, setIsSending] = useState(false);
  // null = no bridge in this environment (clipboard-only) — indicator hidden.
  const [bridgeOnline, setBridgeOnline] = useState<boolean | null>(null);
  // Bumped when the selection changes so an in-flight onSend can't write
  // feedback into a panel that now shows a different element.
  const createSeq = useRef(0);

  const anchor = chain[chainIndex] ?? null;
  const instanceCount = useMemo(() => (anchor ? countInstances(anchor) : 0), [anchor]);

  const openPanel = useCallback(() => setPanelOpen(true), []);

  const hidePanel = useCallback(() => {
    setPanelOpen(false);
    setSelecting(false);
    setHoverAnchor(null);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpen(prev => {
      if (prev) {
        setSelecting(false);
        setHoverAnchor(null);
      }
      return !prev;
    });
  }, []);

  const toggleInspect = useCallback(() => {
    setSelecting(prev => !prev);
    setHoverAnchor(null);
    setFeedback('');
  }, []);

  // Attached images behave like the draft text: they persist across selection
  // changes and hide/show, until removed manually.
  const addImages = useCallback(async (files: Iterable<File>) => {
    const candidates = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!candidates.length) return;
    const sized = candidates.filter(f => f.size <= MAX_IMAGE_BYTES);
    const read = await Promise.all(sized.map(readImage));
    let skipped = candidates.length - sized.length;
    setImages(prev => {
      const next = [...prev, ...read].slice(0, MAX_IMAGES);
      skipped += prev.length + read.length - next.length;
      return next;
    });
    if (skipped > 0) setFeedback(`${skipped} image(s) skipped — max ${MAX_IMAGES} images, 5 MB each`);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => setImages([]), []);

  const clearSelection = useCallback(() => {
    createSeq.current += 1;
    setChain([]);
    setChainIndex(0);
    setInstanceVsShared('shared');
    setFeedback('');
  }, []);

  // Global hotkey: Cmd/Ctrl+Shift+E shows/hides the prompt box.
  useEffect(() => {
    if (!getConfig().hotkey) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault();
        togglePanel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [togglePanel]);

  // Inspect mode: hover tracking + click capture. The app must never receive
  // pointer events while selecting, so everything is intercepted in the
  // capture phase (except events on the overlay's own UI — the prompt box
  // stays usable while inspect is armed).
  useEffect(() => {
    if (!selecting) return;

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
      createSeq.current += 1; // a new selection invalidates an in-flight onSend
      setChain(getAncestorChain(found));
      setChainIndex(0);
      setInstanceVsShared('shared');
      setFeedback('');
      setHoverAnchor(null);
      setSelecting(false);
    };

    document.addEventListener('mouseover', onMouseOver, true);
    document.addEventListener('pointerdown', swallow, true);
    document.addEventListener('mousedown', swallow, true);
    document.addEventListener('mouseup', swallow, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('pointerdown', swallow, true);
      document.removeEventListener('mousedown', swallow, true);
      document.removeEventListener('mouseup', swallow, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [selecting]);

  // While the box is open: poll the bridge's /health so the status dot tracks
  // whether the agent session (which owns the bridge process) is alive.
  // Skipped entirely when MCP is disabled — no bridge to watch.
  useEffect(() => {
    if (!panelOpen || getConfig().disableMCP) return;
    let cancelled = false;
    const check = async () => {
      const ok = await checkBridgeHealth();
      if (!cancelled) setBridgeOnline(ok);
    };
    check();
    const id = setInterval(check, HEALTH_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [panelOpen]);

  // While the box is open: ESC disarms inspect, then hides the box;
  // ↑/↓ walk the ancestor breadcrumb (outside inputs).
  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selecting) {
          setSelecting(false);
          setHoverAnchor(null);
        } else {
          hidePanel();
        }
        return;
      }
      if (selecting || !anchor || isTypingTarget(e.target)) return;
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
  }, [panelOpen, selecting, anchor, chain.length, hidePanel]);

  // Shared send core. `custom` routes to the user's onSend callback; otherwise
  // the default bridge/clipboard delivery. Both capture the payload, then clear
  // the form so a follow-up selection starts fresh.
  const runSend = useCallback(
    async (custom: boolean) => {
      if (!anchor || !userRequest.trim() || isSending) return;
      const payload = buildPayload(anchor, {
        userRequest: userRequest.trim(),
        instanceVsShared,
        images,
      });

      // Clear the form and selection immediately — payload is already captured.
      setIsSending(true);
      setFeedback('');
      setUserRequest('');
      setImages([]);
      setChain([]);
      setChainIndex(0);
      setInstanceVsShared('shared');

      const seq = createSeq.current;
      try {
        if (custom) {
          const onSend = getConfig().onSend;
          if (!onSend) return;
          const message = await onSend(payload);
          if (seq !== createSeq.current) return; // a new selection superseded this send
          setFeedback(typeof message === 'string' && message ? message : 'Sent ✓');
        } else {
          const result = await deliver(payload);
          if (seq !== createSeq.current) return;
          if (result.method === 'bridge') setBridgeOnline(true);
          else setBridgeOnline(prev => (prev === null ? prev : false));
          if (result.method === 'bridge') {
            setFeedback(
              result.channelPushed
                ? 'Sent to Claude, applies automatically in a --channels session (else run /apply-edit)'
                : 'Sent to bridge, run /apply-edit in your agent'
            );
          } else if (result.method === 'clipboard') setFeedback('Copied ✓ — paste into your agent');
          else setFeedback('Copy failed — clipboard unavailable in this context');
        }
      } catch (err) {
        if (seq === createSeq.current) {
          setFeedback(err instanceof Error && err.message ? `Send failed — ${err.message}` : 'Send failed');
        }
      } finally {
        setIsSending(false);
      }
    },
    [anchor, userRequest, instanceVsShared, images, isSending]
  );

  const handleSendToAgent = useCallback(() => runSend(false), [runSend]);
  const handleCustomSend = useCallback(() => runSend(true), [runSend]);

  // Auto-clear feedback after 5 s so it never lingers indefinitely.
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(() => setFeedback(''), 5000);
    return () => clearTimeout(id);
  }, [feedback]);

  const handleCopyTicket = useCallback(async () => {
    if (!anchor) return;
    const payload = buildPayload(anchor, {
      userRequest: userRequest.trim(),
      instanceVsShared,
    });
    const ok = await copyText(serializeTicket(payload));
    setFeedback(ok ? 'Ticket context copied ✓' : 'Copy failed — clipboard unavailable in this context');
  }, [anchor, userRequest, instanceVsShared]);

  return {
    images,
    addImages,
    removeImage,
    clearImages,
    panelOpen,
    selecting,
    openPanel,
    hidePanel,
    toggleInspect,
    clearSelection,
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
    bridgeOnline,
    isSending,
    handleSendToAgent,
    handleCustomSend,
    handleCopyTicket,
  };
}
