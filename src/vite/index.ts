/**
 * react-specter — Vite plugin (also covers Remix, Astro, TanStack Start and
 * anything else Vite-based, including Rollup which shares the same hook shape).
 *
 * Runs its own Babel pass in a `enforce: 'pre'` transform hook, so it works
 * with BOTH @vitejs/plugin-react and @vitejs/plugin-react-swc — annotation
 * happens before either compiles the JSX away. Place it before the React
 * plugin in your `plugins` array.
 *
 *   // vite.config.ts
 *   import specter from 'react-specter/vite';
 *   export default defineConfig({ plugins: [specter(), react()] });
 *
 * Dev-server only by default; production builds ship clean. Pass
 * `enabled: true` to stamp a deployed internal/dev build on purpose, e.g.
 * `specter({ enabled: process.env.SPECTER === 'true' || undefined })`.
 */
import { annotate, shouldTransform } from '../transform';

export interface SpecterVitePluginOptions {
  /**
   * Force the plugin on (true) or off (false) regardless of mode.
   * Default: active only for the dev server (`vite serve`).
   */
  enabled?: boolean;
  /** Which files to annotate. Default: `/\.[jt]sx$/` outside node_modules. */
  include?: RegExp;
  /** Extra Babel parser plugins (e.g. 'decorators-legacy'). */
  parserPlugins?: string[];
}

// Structural subset of Vite's Plugin type — avoids a dependency on vite
// itself while staying assignable to `Plugin` in consumer configs.
interface SpecterVitePlugin {
  name: string;
  enforce: 'pre';
  configResolved(config: { root: string; command: string }): void;
  transform(code: string, id: string): Promise<{ code: string; map: unknown } | null>;
}

export default function specter(options: SpecterVitePluginOptions = {}): SpecterVitePlugin {
  let root = process.cwd();
  let active = options.enabled ?? false;
  let warnedOnce = false;

  return {
    name: 'react-specter',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      active = options.enabled ?? config.command === 'serve';
    },
    async transform(code, id) {
      if (!active || !shouldTransform(id, options)) return null;
      try {
        return await annotate(code, {
          filename: id.split('?')[0],
          root,
          parserPlugins: options.parserPlugins,
        });
      } catch (err) {
        // Never break the consumer's dev server over an annotation failure
        // (e.g. syntax our parser config doesn't know) — serve it unstamped.
        if (!warnedOnce) {
          warnedOnce = true;
          console.warn(
            `[react-specter] could not annotate ${id} — serving it unstamped. ` +
              `If your code uses non-standard syntax, pass parserPlugins. ` +
              `(${err instanceof Error ? err.message : String(err)})`
          );
        }
        return null;
      }
    },
  };
}
