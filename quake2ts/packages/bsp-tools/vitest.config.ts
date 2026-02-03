import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/bsp-tools': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'threads',
    // isolate: false, // Enable isolation to prevent mock leakage
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
