import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/test-utils': path.resolve(import.meta.dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(import.meta.dirname, '../server/src/index.ts'),
      '@quake2ts/shared': path.resolve(import.meta.dirname, './src/index.ts'),
      '@quake2ts/engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      '@quake2ts/game': path.resolve(import.meta.dirname, '../game/src/index.ts'),
      '@quake2ts/client': path.resolve(import.meta.dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(import.meta.dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit-node/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    // Optimize unit test performance - shared package has stateless utility functions
    pool: 'threads',
    isolate: false,
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
