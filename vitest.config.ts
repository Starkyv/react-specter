import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node', // DOM-dependent test files opt into jsdom via @vitest-environment pragma
  },
});
