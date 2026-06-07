import { defineConfig } from 'tsup';

export default defineConfig([
  // Node-side entries: bundler adapters. No React, no DOM.
  {
    entry: {
      babel: 'src/babel/index.ts',
      vite: 'src/vite/index.ts',
      webpack: 'src/webpack/index.ts',
      next: 'src/next/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    platform: 'node',
    target: 'node18',
    sourcemap: true,
    splitting: false,
    clean: true,
    outDir: 'dist',
  },
  // Browser-side entries: the inspector overlay and optional integrations.
  // The 'use client' banner makes the bare import work inside Next.js App
  // Router server components without a wrapper file.
  {
    entry: {
      'overlay/index': 'src/overlay/index.tsx',
      clickup: 'src/integrations/clickup.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    splitting: false,
    banner: { js: "'use client';" },
    external: ['react', 'react-dom', 'react/jsx-runtime'],
    outDir: 'dist',
  },
]);
