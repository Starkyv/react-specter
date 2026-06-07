/**
 * react-specter — webpack transform loader.
 *
 * A deliberately plain string-in/string-out loader so the same entry works in:
 *  - webpack 4/5 (`module.rules` with `enforce: 'pre'` so it sees raw source)
 *  - Rspack / Rsbuild (webpack-loader compatible)
 *  - Next.js webpack builds (wired automatically by `react-specter/next`)
 *  - Turbopack (`turbopack.rules`, which runs webpack transform loaders)
 *  - CRA via craco / react-app-rewired
 *
 * Gate it to development yourself (or use `react-specter/next`, which does):
 * the loader annotates whenever it is in the pipeline.
 */
import { annotate, shouldTransform } from '../transform';

interface LoaderContext {
  async(): (err: Error | null, code?: string, map?: unknown) => void;
  resourcePath: string;
  rootContext?: string;
  emitWarning?(err: Error): void;
  getOptions?(): SpecterLoaderOptions;
}

export interface SpecterLoaderOptions {
  /** Which files to annotate. Default: `/\.[jt]sx$/` outside node_modules. */
  include?: RegExp;
  /** Extra Babel parser plugins (e.g. 'decorators-legacy'). */
  parserPlugins?: string[];
}

export default function specterLoader(this: LoaderContext, source: string, map?: unknown): void {
  const callback = this.async();
  const filename = this.resourcePath;
  // rootContext is unavailable in some Turbopack versions — fall back to cwd.
  const root = this.rootContext || process.cwd();
  const options = this.getOptions?.() ?? {};

  if (!shouldTransform(filename, options)) {
    callback(null, source, map);
    return;
  }

  annotate(source, { filename, root, parserPlugins: options.parserPlugins }).then(
    result => {
      if (result) callback(null, result.code, result.map ?? map);
      else callback(null, source, map);
    },
    err => {
      // Never break the consumer's build — pass the source through unstamped.
      this.emitWarning?.(
        new Error(`[react-specter] could not annotate ${filename}: ${err instanceof Error ? err.message : err}`)
      );
      callback(null, source, map);
    }
  );
}
