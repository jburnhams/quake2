import { defineConfig } from 'vitest/config';
import path from 'path';

const isUnit = process.env.TEST_TYPE === 'unit';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
      '@quake2ts/engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      '@quake2ts/game': path.resolve(import.meta.dirname, '../game/src/index.ts'),
      '@quake2ts/cgame': path.resolve(import.meta.dirname, '../cgame/src/index.ts'),
      '@quake2ts/server': path.resolve(import.meta.dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(import.meta.dirname, '../client/src/index.ts'),
    },
  },
  test: {
    // If we are running unit tests, we want to exclude everything in this package
    // since these are end-to-end tests requiring browsers.
    include: isUnit ? [] : ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 120000,
    hookTimeout: 120000,
    pool: 'forks',
    maxWorkers: 1,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
