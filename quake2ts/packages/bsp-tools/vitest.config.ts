import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/test-utils': path.resolve(import.meta.dirname, '../test-utils/src/index.ts'),
      '@quake2ts/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
      '@quake2ts/bsp-tools': path.resolve(import.meta.dirname, './src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit-node/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'threads',
    isolate: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
