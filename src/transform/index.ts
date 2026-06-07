/**
 * react-specter — bundler-agnostic transform core.
 *
 * Wraps the Babel plugin in a self-contained `transformAsync` call so the
 * vite/webpack adapters can annotate source without touching (or being
 * affected by) the consumer's own Babel configuration.
 */
import { transformAsync } from '@babel/core';

import specterAnnotateSource from '../babel';

export interface AnnotateOptions {
  /** Absolute path of the file being transformed. */
  filename: string;
  /** Project root used to make stamped paths repo-relative. */
  root?: string;
  /**
   * Extra Babel parser plugins for non-standard syntax in your codebase
   * (e.g. 'decorators-legacy'). 'jsx' and 'typescript' are inferred from the
   * file extension.
   */
  parserPlugins?: string[];
}

export interface AnnotateResult {
  code: string;
  map: unknown;
}

const JSX_FILE_RE = /\.[jt]sx$/;

export interface ShouldTransformOptions {
  /** Which files to annotate. Default: `/\.[jt]sx$/` outside node_modules. */
  include?: RegExp;
}

/** Shared file filter for all adapters. Strips bundler query suffixes. */
export function shouldTransform(id: string, options: ShouldTransformOptions = {}): boolean {
  if (id.startsWith('\0')) return false; // bundler-virtual modules
  const file = id.split('?')[0];
  if (file.includes('/node_modules/') || file.includes('\\node_modules\\')) return false;
  return (options.include ?? JSX_FILE_RE).test(file);
}

/**
 * Annotate one module's source. Returns null when Babel produces no output.
 * Throws on parse errors — adapters catch and fall back to the original
 * source so react-specter can never break a dev build.
 */
export async function annotate(code: string, options: AnnotateOptions): Promise<AnnotateResult | null> {
  const { filename, root, parserPlugins = [] } = options;
  const isTypeScript = /\.tsx?$/.test(filename);

  const result = await transformAsync(code, {
    filename,
    // Fully self-contained: never pick up the consumer's Babel config —
    // their own pipeline (or ours, alone) must not run twice.
    babelrc: false,
    configFile: false,
    browserslistConfigFile: false,
    sourceType: 'unambiguous',
    sourceMaps: true,
    // Keep output lines aligned with input lines so downstream tools (and the
    // stamped line numbers themselves) stay trustworthy even without maps.
    retainLines: true,
    parserOpts: {
      plugins: [...(isTypeScript ? (['typescript', 'jsx'] as const) : (['jsx'] as const)), ...parserPlugins] as never[],
    },
    plugins: [[specterAnnotateSource, { root }]],
  });

  if (!result || result.code == null) return null;
  return { code: result.code, map: result.map ?? null };
}
