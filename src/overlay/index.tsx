/**
 * react-specter — overlay entry point.
 *
 * Mounts the inspector into its own React root (`#specter-root`), fully
 * outside the app tree: no router, no stores, no app context needed.
 *
 * Two ways to use it:
 *  - `mountSpecter(options)` — imperative, e.g. behind a guarded dynamic
 *    import in your client entry file.
 *  - `<Specter {...options} />` — a render-nothing client component, e.g. in
 *    a Next.js App Router layout.
 *
 * SSR-safe (no-ops off-DOM) and production-safe (refuses to mount when
 * NODE_ENV === 'production' unless `force` is set).
 */
import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { ROOT_ID } from '../constants';
import Inspector from './Inspector';
import { setConfig, type SpecterOptions } from './options';
import { injectStyles, removeStyles } from './styles';

export type { SendFn, SpecterOptions } from './options';
export type { InstanceVsShared, SpecterImage, SpecterPayload } from './payload';

let root: Root | null = null;
let container: HTMLElement | null = null;

function isProductionBuild(): boolean {
  // Bundlers statically replace process.env.NODE_ENV in browser builds; the
  // try/catch covers raw-ESM contexts where `process` doesn't exist.
  try {
    return process.env.NODE_ENV === 'production';
  } catch {
    return false;
  }
}

/**
 * Mount the inspector overlay. Idempotent — a second call (HMR, React strict
 * mode) re-uses the existing mount. Returns an unmount function.
 */
export function mountSpecter(options: SpecterOptions = {}): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}; // SSR no-op
  if (options.enabled === false) return () => {};
  if (isProductionBuild() && !options.force) return () => {};

  setConfig(options);
  if (document.getElementById(ROOT_ID)) return unmountSpecter; // idempotent (HMR re-runs)

  injectStyles();
  container = document.createElement('div');
  container.id = ROOT_ID;
  document.body.appendChild(container);
  root = createRoot(container);
  root.render(<Inspector />);
  return unmountSpecter;
}

/** Remove the overlay and its injected styles. Idempotent. */
export function unmountSpecter(): void {
  root?.unmount();
  container?.remove();
  // Cover externally-recreated roots (e.g. two copies of this module).
  document.getElementById(ROOT_ID)?.remove();
  removeStyles();
  root = null;
  container = null;
}

/**
 * Render-nothing component wrapper around mountSpecter — for JSX-only spots
 * like a Next.js App Router layout:
 *
 *   {process.env.NODE_ENV === 'development' && <Specter />}
 *
 * Options are read once, at first mount.
 */
export function Specter(options: SpecterOptions = {}): null {
  const optionsRef = useRef(options);
  useEffect(() => mountSpecter(optionsRef.current), []);
  return null;
}
