/**
 * react-specter overlay — styles, injected as a single <style> tag at mount.
 *
 * Plain CSS with a `specter-` class prefix (no CSS modules, no Sass, no
 * framework CSS pipeline) so consumers need zero build configuration and no
 * stylesheet import — critical for working identically across Vite, Next.js,
 * CRA, etc. The overlay lives in its own React root outside the app tree;
 * the prefix plus max z-index keeps it collision-free.
 */
import { STYLE_TAG_ID } from '../constants';

const FONT = "'Inter', 'Roboto', sans-serif";

const css = `
.specter-toggle {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  background-color: #fff;
  color: #475467;
  font-family: ${FONT};
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 2147483647;
  transition: all 0.2s ease-in-out;
}
.specter-toggle:hover {
  border-color: #0878e8;
  color: #0878e8;
  box-shadow: 0 2px 8px rgba(8, 120, 232, 0.15);
}
.specter-toggle.is-active {
  background-color: #0878e8;
  color: #fff;
  border-color: #0878e8;
}

.specter-outline {
  position: fixed;
  top: var(--specter-top, 0);
  left: var(--specter-left, 0);
  width: var(--specter-width, 0);
  height: var(--specter-height, 0);
  border: 1px solid rgba(8, 120, 232, 0.7);
  background-color: rgba(8, 120, 232, 0.05);
  border-radius: 2px;
  pointer-events: none;
  z-index: 2147483646;
}
.specter-outline-label {
  position: absolute;
  top: -22px;
  left: -1px;
  padding: 2px 6px;
  background-color: rgba(8, 120, 232, 0.92);
  color: #fff;
  font-family: ${FONT};
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  border-radius: 2px;
}
.specter-outline.is-captured {
  border-color: rgba(124, 58, 237, 0.7);
  background-color: rgba(124, 58, 237, 0.05);
}
.specter-outline.is-captured .specter-outline-label {
  background-color: rgba(124, 58, 237, 0.92);
}

.specter-panel {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 360px;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background-color: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  padding: 12px;
  z-index: 2147483647;
  font-family: ${FONT};
  font-size: 13px;
  color: #344054;
}

.specter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.specter-title {
  font-weight: 600;
  font-size: 13px;
  color: #344054;
}
.specter-close {
  border: none;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: #667085;
}
.specter-close:hover {
  color: #344054;
}

.specter-breadcrumb {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}
.specter-crumb {
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  background-color: #fff;
  padding: 2px 8px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  color: #475467;
}
.specter-crumb:hover {
  border-color: #0878e8;
  color: #0878e8;
}
.specter-crumb.is-active {
  background-color: #eff6ff;
  border-color: #0878e8;
  color: #0878e8;
}

.specter-meta {
  margin: 0 0 8px;
}
.specter-meta-row {
  display: flex;
  gap: 6px;
  margin-bottom: 4px;
}
.specter-meta-row dt {
  flex: 0 0 52px;
  color: #667085;
}
.specter-meta-row dd {
  margin: 0;
  min-width: 0;
}
.specter-meta-row dd code {
  display: block;
  font-family: ${FONT};
  font-size: 11px;
  word-break: break-all;
  background-color: #f8f9fb;
  border-radius: 4px;
  padding: 2px 4px;
  max-height: 60px;
  overflow: hidden;
}

.specter-guard {
  border: 1px solid #f2dcab;
  background-color: #fffbf2;
  border-radius: 4px;
  padding: 8px;
  margin: 0 0 8px;
}
.specter-guard legend {
  font-size: 12px;
  padding: 0 4px;
  color: #92400e;
}
.specter-guard-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 2px 0;
}

.specter-request-label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}
.specter-request {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  margin-bottom: 8px;
}
.specter-request:focus {
  outline: none;
  border-color: #0878e8;
}

.specter-actions {
  display: flex;
  gap: 8px;
}
.specter-btn {
  flex: 1;
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  background-color: #fff;
  color: #475467;
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.specter-btn:hover:not(:disabled) {
  border-color: #0878e8;
  color: #0878e8;
}
.specter-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.specter-btn.is-primary {
  background-color: #0878e8;
  border-color: #0878e8;
  color: #fff;
}
.specter-btn.is-primary:hover:not(:disabled) {
  background-color: #0a66c2;
  color: #fff;
}

.specter-ticket-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.specter-ticket-title {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 12px;
  color: #344054;
}
.specter-ticket-title::placeholder {
  color: #98a2b3;
}
.specter-ticket-title:focus {
  outline: none;
  border-color: #0878e8;
}
.specter-ticket-btn {
  flex-shrink: 0;
  border: 1px solid #e4e7ec;
  border-radius: 4px;
  background-color: #fff;
  color: #475467;
  padding: 6px 10px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.specter-ticket-btn:hover:not(:disabled) {
  border-color: #0878e8;
  color: #0878e8;
}
.specter-ticket-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.specter-feedback {
  margin: 8px 0 0;
  font-size: 12px;
  color: #027a48;
}
.specter-feedback-link {
  color: #0878e8;
  text-decoration: underline;
}

.specter-offscreen {
  position: fixed;
  top: -9999px;
  left: -9999px;
  opacity: 0;
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
