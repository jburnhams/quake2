import { defineConfig } from 'vitest/config';
import nodeConfig from '../vitest.node';

// Differential tests against the C original. Reuses the node config's aliases so
// the TS side runs from source, but runs only the oracle tests.
export default defineConfig({
  resolve: nodeConfig.resolve,
  test: {
    environment: 'node',
    include: ['oracle/tests/**/*.test.ts'],
    globalSetup: ['oracle/tests/build.global.ts'],
    pool: 'forks',
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
