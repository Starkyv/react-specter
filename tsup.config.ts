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
    // No per-config clean: both configs share outDir and run concurrently, so
    // a config-level clean races the other's DTS output. The build script
    // clears dist once up front instead.
    clean: false,
    outDir: 'dist',
  },
  // Browser-side entry: the inspector overlay.
  // The 'use client' banner makes the bare import work inside Next.js App
  // Router server components without a wrapper file.
  {
    entry: {
      'overlay/index': 'src/overlay/index.tsx',
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
