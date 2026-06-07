/**
 * react-specter — Next.js config wrapper.
 *
 *   // next.config.mjs
 *   import { withSpecter } from 'react-specter/next';
 *   export default withSpecter({ ...yourConfig });
 *
 * Wires the react-specter webpack loader into BOTH compilation targets:
 *  - webpack (`next dev`) — server + client compilations, so SSR'd HTML and
 *    client-rendered JSX carry identical stamps (no hydration mismatches)
 *  - Turbopack (`next dev --turbopack`, Next 15+) via `turbopack.rules`
 *
 * Active only when NODE_ENV !== 'production' at config-evaluation time, so
 * `next build` / `next start` ship clean. Override with `enabled`.
 */

const LOADER = 'react-specter/webpack';

export interface WithSpecterOptions {
  /**
   * Force on (true) or off (false).
   * Default: `process.env.NODE_ENV !== 'production'` — i.e. `next dev` only.
   */
  enabled?: boolean;
  /**
   * Also register `turbopack.rules` (Next 15+ config key). Set false on
   * Next 13/14 to avoid an unknown-key warning if you only use webpack dev.
   */
  turbopack?: boolean;
}

// next.config is plain JS at heart; typed structurally to avoid a dependency
// on next itself.
type NextConfig = Record<string, any>;

export function withSpecter(nextConfig: NextConfig = {}, options: WithSpecterOptions = {}): NextConfig {
  const enabled = options.enabled ?? process.env.NODE_ENV !== 'production';
  if (!enabled) return nextConfig;

  const useTurbopack = options.turbopack ?? true;

  const turbopackRules = {
    '*.jsx': { loaders: [LOADER], as: '*.jsx' },
    '*.tsx': { loaders: [LOADER], as: '*.tsx' },
  };

  return {
    ...nextConfig,
    ...(useTurbopack
      ? {
          turbopack: {
            ...nextConfig.turbopack,
            rules: { ...turbopackRules, ...nextConfig.turbopack?.rules },
          },
        }
      : {}),
    webpack(config: any, context: any) {
      // enforce: 'pre' → runs before Next's SWC/Babel loaders, on raw source.
      config.module.rules.push({
        test: /\.[jt]sx$/,
        exclude: /node_modules/,
        enforce: 'pre',
        use: [{ loader: LOADER }],
      });
      return typeof nextConfig.webpack === 'function' ? nextConfig.webpack(config, context) : config;
    },
  };
}

export default withSpecter;
