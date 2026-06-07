/**
 * react-specter overlay — styles, injected as a single <style> tag at mount.
 *
 * Plain CSS with a `specter-` class prefix (no CSS modules, no Sass, no
 * framework CSS pipeline) so consumers need zero build configuration and no
 * stylesheet import — critical for working identically across Vite, Next.js,
 * CRA, etc. The overlay lives in its own React root outside the app tree;
 * the prefix plus max z-index keeps it collision-free.
 *
 * Theme: holographic pastel gradient frame around a white card, pill-shaped
 * controls, violet gradient accents. The prompt box show/hide animates via
 * opacity + transform on the inner shell (visibility, not display, so both
 * directions transition); `prefers-reduced-motion` turns all of it off.
 */
import { STYLE_TAG_ID } from '../constants';

// Claude's UI font (Styrene) first — it's licensed, so no bundling/hotlinking;
// when absent this falls through to the same system sans stack Claude Desktop
// renders natively.
const FONT =
  "'Styrene B', 'Styrene A', ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace";
const ACCENT_GRADIENT = 'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)';

const css = `
@keyframes specter-pop-in {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes specter-spin {
  to { transform: rotate(360deg); }
}
@keyframes specter-thumb-enter {
  from { opacity: 0; transform: scale(0.72); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes specter-feedback-enter {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}

.specter-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 999px;
  background: ${ACCENT_GRADIENT};
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(109, 40, 217, 0.35);
  z-index: 2147483647;
  animation: specter-pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.specter-toggle:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 20px rgba(109, 40, 217, 0.45);
}

.specter-outline {
  position: fixed;
  top: var(--specter-top, 0);
  left: var(--specter-left, 0);
  width: var(--specter-width, 0);
  height: var(--specter-height, 0);
  border: 1px solid rgba(139, 92, 246, 0.75);
  background-color: rgba(139, 92, 246, 0.06);
  border-radius: 3px;
  pointer-events: none;
  z-index: 2147483646;
}
.specter-outline-label {
  position: absolute;
  top: -22px;
  left: -1px;
  padding: 2px 7px;
  background-color: rgba(124, 58, 237, 0.92);
  color: #fff;
  font-family: ${FONT};
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  border-radius: 999px;
}
.specter-outline.is-captured {
  border-color: rgba(219, 39, 119, 0.7);
  background-color: rgba(219, 39, 119, 0.05);
}
.specter-outline.is-captured .specter-outline-label {
  background-color: rgba(219, 39, 119, 0.92);
}

.specter-promptbox {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: 680px;
  min-width: 360px;
  max-width: min(900px, calc(100vw - 32px));
  z-index: 2147483647;
  font-family: ${FONT};
  font-size: 13px;
  color: #344054;
  visibility: visible;
  transition: visibility 0s;
}
.specter-promptbox.is-hidden {
  visibility: hidden;
  pointer-events: none;
  transition: visibility 0s 0.25s; /* let the fade-out play before hiding */
}

.specter-shell {
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  border-radius: 22px;
  padding: 8px;
  background: linear-gradient(115deg, #fde7f3 0%, #ece2fb 30%, #dfe3fc 55%, #dcedfd 80%, #e3f7f7 100%);
  box-shadow: 0 16px 48px rgba(85, 60, 200, 0.22), 0 2px 8px rgba(85, 60, 200, 0.1);
  opacity: 1;
  transform: translateY(0) scale(1);
  transform-origin: 50% 100%;
  transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.specter-promptbox.is-hidden .specter-shell {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}

.specter-drag-handle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 10px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  justify-content: space-between;
}
.specter-drag-handle:active {
  cursor: grabbing;
}
.specter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: ${ACCENT_GRADIENT};
  color: #fff;
  box-shadow: 0 2px 6px rgba(109, 40, 217, 0.35);
}
.specter-title {
  font-weight: 600;
  font-size: 13px;
  color: #3b3654;
}
.specter-powered {
  margin-left: auto;
  font-size: 11px;
  color: #7a7596;
}
.specter-status {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #7a7596;
  cursor: default;
}
.specter-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #9ca3af;
}
.specter-status.is-online .specter-status-dot {
  background: #10b981;
  animation: specter-pulse 2s ease-in-out infinite;
}
.specter-status.is-offline .specter-status-dot {
  background: #f87171;
}
@keyframes specter-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
  50% { box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.08); }
}
.specter-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  color: #6b6685;
  transition: background 0.15s ease, color 0.15s ease;
}
.specter-close:hover {
  background: rgba(255, 255, 255, 0.95);
  color: #3b3654;
}

.specter-card {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(40, 30, 90, 0.06);
}

.specter-context {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.specter-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.specter-crumb {
  border: 1px solid #e9e6f7;
  border-radius: 999px;
  background: #f7f6fc;
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  color: #5b5575;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}
.specter-crumb:hover {
  border-color: #a855f7;
  color: #6d28d9;
}
.specter-crumb.is-active {
  background: #f3e8ff;
  border-color: #a855f7;
  color: #6d28d9;
}
.specter-crumb-clear {
  color: #a39ec0;
}
.specter-crumb-clear:hover {
  border-color: #ef4444;
  color: #ef4444;
}
.specter-source {
  display: inline-flex;
  font-family: ${MONO};
  font-size: 10.5px;
  color: #7a7596;
  background: #f7f6fc;
  border-radius: 999px;
  padding: 3px 10px;
  word-break: break-all;
}
.specter-empty {
  margin: 0 0 10px;
  font-size: 12px;
  color: #8d88a8;
}

.specter-guard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #eceafb;
  background: #fbfaff;
  border-radius: 12px;
  padding: 10px 12px;
  margin: 0 0 10px;
}
.specter-guard legend {
  padding: 0;
  margin: 0 0 4px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.45;
  color: #5b5575;
}
/* Plain radio rows — native inputs, tinted to the accent. */
.specter-guard-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: #6b6585;
  cursor: pointer;
  transition: color 0.15s ease;
}
.specter-guard-option input {
  margin: 0;
  width: 14px;
  height: 14px;
  accent-color: #6d28d9;
  cursor: pointer;
}
.specter-guard-option:hover {
  color: #3f3a58;
}
.specter-guard-option:has(input:checked) {
  color: #2f2a45;
  font-weight: 600;
}
.specter-guard-option:has(input:focus-visible) {
  outline: 2px solid rgba(168, 85, 247, 0.45);
  outline-offset: 2px;
  border-radius: 6px;
}

.specter-request {
  width: 100%;
  box-sizing: border-box;
  border: none;
  background: transparent;
  padding: 2px 0 10px;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.5;
  color: #2c2747;
  resize: none;
  outline: none;
}
.specter-request::placeholder {
  color: #b4b0c9;
}

.specter-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 10px;
  padding: 10px 10px 0;
}
.specter-thumb {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 14px;
  /* overflow: visible so the remove button can hang outside the corner */
  overflow: visible;
  background: #f7f6fc;
  animation: specter-thumb-enter 0.22s cubic-bezier(0.16, 1, 0.3, 1);
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
}
.specter-thumb:hover {
  transform: scale(1.04);
  box-shadow: 0 4px 14px rgba(109, 40, 217, 0.2);
}
.specter-thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 14px;
  border: 1.5px solid #e9e6f7;
  box-sizing: border-box;
}
.specter-thumb-remove {
  position: absolute;
  top: -5px;
  right: -5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: #fff;
  color: #1c1830;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06);
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.15s ease;
}
.specter-thumb:hover .specter-thumb-remove,
.specter-thumb-remove:focus-visible {
  opacity: 1;
}
.specter-thumb-remove:hover {
  background: #fff1f1;
  color: #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25), 0 0 0 1px rgba(220, 38, 38, 0.15);
  transform: scale(1.12);
}
.specter-thumb-remove:active {
  transform: scale(0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.specter-file-input {
  display: none;
}

.specter-resize-handle {
  position: absolute;
  right: -6px;
  top: 14px;
  bottom: 14px;
  width: 12px;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  border-radius: 0 8px 8px 0;
}
.specter-resize-handle::after {
  content: '';
  width: 3px;
  height: 32px;
  border-radius: 99px;
  background: transparent;
  transition: background 0.2s ease, height 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
.specter-promptbox:hover .specter-resize-handle::after {
  background: rgba(139, 92, 246, 0.2);
}
.specter-resize-handle:hover::after {
  background: rgba(109, 40, 217, 0.55);
  height: 44px;
}
.specter-resize-handle:active::after {
  background: rgba(109, 40, 217, 0.75);
}

.specter-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  animation: specter-spin 0.6s linear infinite;
  flex-shrink: 0;
}
.specter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.specter-spacer {
  flex: 1;
}
.specter-inspect {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid #eceafb;
  border-radius: 999px;
  background: #f7f6fc;
  color: #5b5575;
  padding: 8px 14px;
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.specter-inspect:hover {
  border-color: #a855f7;
  color: #6d28d9;
  background: #f6effe;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(109, 40, 217, 0.15);
}
.specter-inspect:active {
  transform: translateY(0) scale(0.96);
  box-shadow: none;
}
.specter-inspect.is-active {
  background: ${ACCENT_GRADIENT};
  border-color: transparent;
  color: #fff;
  box-shadow: 0 3px 12px rgba(109, 40, 217, 0.4);
}
.specter-inspect.is-active:hover {
  box-shadow: 0 5px 18px rgba(109, 40, 217, 0.55);
  transform: translateY(-1px);
}
.specter-inspect.is-active:active {
  transform: translateY(0) scale(0.96);
  box-shadow: 0 1px 4px rgba(109, 40, 217, 0.3);
}
.specter-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid #eceafb;
  border-radius: 999px;
  background: #fff;
  color: #5b5575;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.specter-iconbtn:hover:not(:disabled) {
  border-color: #a855f7;
  color: #6d28d9;
  background: #f6effe;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(109, 40, 217, 0.15);
}
.specter-iconbtn:active:not(:disabled) {
  transform: translateY(0) scale(0.91);
  box-shadow: none;
  background: #ede9ff;
}
.specter-iconbtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
@keyframes specter-glitter {
  0%   { left: -80%; opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { left: 130%; opacity: 0; }
}
.specter-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 4px;
  background: ${ACCENT_GRADIENT};
  color: #fff;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(109, 40, 217, 0.35);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
/* static gloss layer */
.specter-send::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0%, transparent 55%);
  border-radius: inherit;
  pointer-events: none;
}
/* glitter sweep layer */
.specter-send::before {
  content: '';
  position: absolute;
  top: -20%;
  left: -80%;
  width: 55%;
  height: 140%;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 80%
  );
  transform: skewX(-18deg);
  pointer-events: none;
  opacity: 0;
}
.specter-send:hover:not(:disabled)::before {
  animation: specter-glitter 0.55s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.specter-send:hover:not(:disabled) {
  box-shadow: 0 5px 18px rgba(109, 40, 217, 0.55);
  transform: translateY(-2px) scale(1.08);
}
.specter-send:active:not(:disabled) {
  transform: translateY(0) scale(0.94);
  box-shadow: 0 1px 6px rgba(109, 40, 217, 0.28);
}
.specter-send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.specter-feedback {
  margin: 10px 0 0;
  font-size: 12px;
  color: #027a48;
  animation: specter-feedback-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.specter-feedback-link {
  color: #6d28d9;
  text-decoration: underline;
}

.specter-offscreen {
  position: fixed;
  top: -9999px;
  left: -9999px;
  opacity: 0;
}

/* ── Responsive ─────────────────────────────────────────────────── */
@media (max-width: 720px) {
  .specter-promptbox {
    width: calc(100vw - 32px) !important;
    min-width: 0;
    left: 16px !important;
    right: 16px;
    bottom: 16px;
    transform: none !important;
  }
  .specter-resize-handle {
    display: none;
  }
}
@media (max-width: 480px) {
  .specter-promptbox {
    left: 8px !important;
    right: 8px;
    bottom: 8px;
    width: calc(100vw - 16px) !important;
  }
  .specter-shell {
    border-radius: 18px;
    padding: 6px;
  }
  .specter-card {
    border-radius: 14px;
    padding: 12px;
  }
  .specter-drag-handle {
    cursor: default;
  }
  .specter-actions {
    flex-wrap: wrap;
  }
  .specter-send {
    flex-shrink: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .specter-toggle,
  .specter-status-dot,
  .specter-spinner,
  .specter-thumb,
  .specter-feedback {
    animation: none;
  }
  .specter-send::before {
    display: none;
  }
  .specter-toggle,
  .specter-promptbox,
  .specter-shell,
  .specter-send,
  .specter-close,
  .specter-inspect,
  .specter-iconbtn,
  .specter-crumb,
  .specter-guard-option,
  .specter-thumb,
  .specter-thumb-remove,
  .specter-resize-handle::after {
    transition: none;
  }
}
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_TAG_ID)) return; // idempotent
  const el = document.createElement('style');
  el.id = STYLE_TAG_ID;
  el.textContent = css;
  document.head.appendChild(el);
}

export function removeStyles(): void {
  document.getElementById(STYLE_TAG_ID)?.remove();
}
