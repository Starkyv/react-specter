/**
 * react-specter overlay — the floating prompt box (Claude-Desktop-style).
 *
 * One draggable card holding the whole flow: an Inspect button to arm element
 * selection, the captured element's context (breadcrumb + source), the change
 * request text box, and the outputs (Send / Copy for ticket).
 * The ✕ in the right corner hides it back to the ◎ launcher.
 *
 * Always mounted (hidden via CSS) so the dragged position and scroll state
 * survive hide/show. Dragging uses pointer capture on the header — no window
 * listeners, works for mouse and touch.
 */
import { useEffect, useRef, useState } from "react";

import cx from "./cx";
import { CopyIcon, CrosshairIcon, ImageIcon, SendIcon, XIcon } from "./icons";
import { getConfig } from "./options";
import { componentOf, InstanceVsShared, sourceOf, SpecterImage } from "./payload";

export interface PromptBoxProps {
  open: boolean;
  selecting: boolean;
  anchor: HTMLElement | null;
  chain: HTMLElement[];
  chainIndex: number;
  onChainIndexChange: (index: number) => void;
  userRequest: string;
  onUserRequestChange: (value: string) => void;
  images: SpecterImage[];
  onAddImages: (files: Iterable<File>) => void;
  onRemoveImage: (index: number) => void;
  instanceCount: number;
  instanceVsShared: InstanceVsShared;
  onInstanceVsSharedChange: (value: InstanceVsShared) => void;
  feedback: string;
  /** null = no bridge in this environment — the indicator is hidden. */
  bridgeOnline: boolean | null;
  isSending: boolean;
  onSendToAgent: () => void;
  onCopyTicket: () => void;
  onToggleInspect: () => void;
  onClearSelection: () => void;
  onHide: () => void;
}

const VIEWPORT_MARGIN = 8;
const MIN_WIDTH = 360;
const MAX_WIDTH = 900;

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), Math.max(lo, hi));
}

export default function PromptBox({
  open,
  selecting,
  anchor,
  chain,
  chainIndex,
  onChainIndexChange,
  userRequest,
  onUserRequestChange,
  images,
  onAddImages,
  onRemoveImage,
  instanceCount,
  instanceVsShared,
  onInstanceVsSharedChange,
  feedback,
  bridgeOnline,
  isSending,
  onSendToAgent,
  onCopyTicket,
  onToggleInspect,
  onClearSelection,
  onHide,
}: PromptBoxProps) {
  const { agentLabel } = getConfig();
  const source = anchor ? sourceOf(anchor) : null;

  const boxRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // null = default CSS position (bottom-center); set once the user drags.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  // null = default CSS width (680px); set once the user resizes.
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  const resizeStart = useRef<{ startX: number; startWidth: number } | null>(null);

  // Images can arrive three ways: the attach button, paste, or drag-drop.
  const onPaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    e.preventDefault();
    onAddImages(files);
  };

  const onDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    e.preventDefault();
    onAddImages(files);
  };

  const onDragStart = (e: React.PointerEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("button")) return; // ✕ stays a click
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault(); // no text selection while dragging
    dragOffset.current = {
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onDragMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: clamp(
        e.clientX - dragOffset.current.dx,
        VIEWPORT_MARGIN,
        window.innerWidth - rect.width - VIEWPORT_MARGIN,
      ),
      y: clamp(
        e.clientY - dragOffset.current.dy,
        VIEWPORT_MARGIN,
        window.innerHeight - rect.height - VIEWPORT_MARGIN,
      ),
    });
  };

  const onDragEnd = () => {
    dragOffset.current = null;
  };

  const onResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    resizeStart.current = { startX: e.clientX, startWidth: rect.width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return;
    const { startX, startWidth } = resizeStart.current;
    const newWidth = clamp(
      startWidth + (e.clientX - startX),
      MIN_WIDTH,
      Math.min(MAX_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2),
    );
    setBoxWidth(newWidth);
  };

  const onResizeEnd = () => {
    resizeStart.current = null;
  };

  // Re-clamp on show — the viewport may have resized while hidden.
  useEffect(() => {
    if (!open || !pos) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(
      pos.x,
      VIEWPORT_MARGIN,
      window.innerWidth - rect.width - VIEWPORT_MARGIN,
    );
    const y = clamp(
      pos.y,
      VIEWPORT_MARGIN,
      window.innerHeight - rect.height - VIEWPORT_MARGIN,
    );
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [open, pos]);

  return (
    <aside
      ref={boxRef}
      className={cx("specter-promptbox", !open && "is-hidden")}
      style={{
        ...(pos && { left: pos.x, top: pos.y, bottom: "auto", transform: "none" }),
        ...(boxWidth && { width: boxWidth }),
      }}
      role="dialog"
      aria-label="Specter prompt"
    >
      <div className="specter-shell">
        <header
          className="specter-drag-handle"
          title="Drag to move"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onLostPointerCapture={onDragEnd}
        >
          {/* <span className="specter-badge">
            <SparkleIcon size={13} />
          </span> */}
          <span className="specter-title">Specter</span>
          {/* <span className="specter-powered">Powered by {agentLabel}</span> */}
          {bridgeOnline !== null && (
            <span
              className={cx(
                "specter-status",
                bridgeOnline ? "is-online" : "is-offline",
              )}
              title={
                bridgeOnline
                  ? `Bridge connected — Send delivers straight to ${agentLabel}`
                  : `Bridge not reachable — Send falls back to the clipboard. Start your ${agentLabel} session (it spawns the bridge via .mcp.json).`
              }
            >
              <span className="specter-status-dot" aria-hidden="true" />
              {bridgeOnline ? "Online" : "Offline"}
            </span>
          )}
          <button
            type="button"
            className="specter-close"
            onClick={onHide}
            title="Hide (Esc)"
          >
            <XIcon size={13} />
          </button>
        </header>

        <div
          className="specter-card"
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {anchor && source ? (
            <div className="specter-context">
              <nav
                className="specter-breadcrumb"
                aria-label="Ancestor components (↑/↓ to walk)"
              >
                {chain.map((el, i) => (
                  <button
                    key={`${componentOf(el)}-${i}`}
                    type="button"
                    className={cx(
                      "specter-crumb",
                      i === chainIndex && "is-active",
                    )}
                    onClick={() => onChainIndexChange(i)}
                  >
                    {componentOf(el)}
                  </button>
                ))}
                <button
                  type="button"
                  className="specter-crumb specter-crumb-clear"
                  onClick={onClearSelection}
                  title="Clear selection"
                >
                  ✕
                </button>
              </nav>
              <code className="specter-source">
                {source.file}:{source.line}
              </code>
            </div>
          ) : (
            <p className="specter-empty">
              {selecting
                ? "Click an element in the page… (Esc cancels)"
                : "No element selected, press Inspect, then click an element."}
            </p>
          )}

          {instanceCount > 1 && (
            <fieldset className="specter-guard">
              <legend>
                This element renders {instanceCount}× on this page. Change just
                this instance, or the component everywhere?
              </legend>
              <label className="specter-guard-option">
                <input
                  type="radio"
                  name="specter-instance-vs-shared"
                  checked={instanceVsShared === "instance"}
                  onChange={() => onInstanceVsSharedChange("instance")}
                />
                Just this instance
              </label>
              <label className="specter-guard-option">
                <input
                  type="radio"
                  name="specter-instance-vs-shared"
                  checked={instanceVsShared === "shared"}
                  onChange={() => onInstanceVsSharedChange("shared")}
                />
                This component everywhere
              </label>
            </fieldset>
          )}

          <textarea
            className="specter-request"
            value={userRequest}
            onChange={(e) => onUserRequestChange(e.target.value)}
            placeholder={`Describe a change and let ${agentLabel} edit the source…`}
            aria-label="Change request"
            rows={3}
          />

          {images.length > 0 && (
            <div className="specter-thumbs">
              {images.map((img, i) => (
                <span className="specter-thumb" key={`${img.name}-${i}`}>
                  <img
                    className="specter-thumb-img"
                    src={`data:${img.mediaType};base64,${img.dataBase64}`}
                    alt={img.name}
                  />
                  <button
                    type="button"
                    className="specter-thumb-remove"
                    onClick={() => onRemoveImage(i)}
                    title={`Remove ${img.name}`}
                  >
                    <XIcon size={14} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="specter-actions">
            <button
              type="button"
              className={cx("specter-inspect", selecting && "is-active")}
              onClick={onToggleInspect}
              title={
                selecting
                  ? "Stop inspecting (Esc)"
                  : "Pick an element on the page"
              }
            >
              <CrosshairIcon size={14} />
              Inspect
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="specter-file-input"
              aria-label="Attach images"
              onChange={(e) => {
                if (e.target.files?.length) onAddImages(e.target.files);
                e.target.value = ""; // re-picking the same file must re-fire
              }}
            />
            <button
              type="button"
              className="specter-iconbtn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
              title="Attach images — or paste / drop them here"
            >
              <ImageIcon size={15} />
            </button>
            <span className="specter-spacer" />
            <button
              type="button"
              className="specter-iconbtn"
              onClick={onCopyTicket}
              disabled={!anchor}
              aria-label="Copy for ticket"
              title={
                anchor
                  ? "Copy element context for a ticket"
                  : "Select an element first"
              }
            >
              <CopyIcon size={15} />
            </button>
            <button
              type="button"
              className="specter-send"
              onClick={onSendToAgent}
              disabled={!anchor || !userRequest.trim() || isSending}
              aria-label={isSending ? "Sending…" : `Send to ${agentLabel}`}
              title={
                !anchor
                  ? "Select an element first"
                  : isSending
                  ? "Sending…"
                  : `Send to ${agentLabel}`
              }
            >
              {isSending ? (
                <span className="specter-spinner" aria-hidden="true" />
              ) : (
                <SendIcon size={15} />
              )}
            </button>
          </div>

          {feedback && <p className="specter-feedback">{feedback}</p>}
        </div>
      </div>
      <div
        className="specter-resize-handle"
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onLostPointerCapture={onResizeEnd}
        title="Drag to resize"
        aria-hidden="true"
      />
    </aside>
  );
}
