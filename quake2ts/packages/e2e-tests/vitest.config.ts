import { defineConfig } from 'vitest/config';
import path from 'path';

const isUnit = process.env.TEST_TYPE === 'unit';

export default defineConfig({
  test: {
    // If we are running unit tests, we want to exclude everything in this package
    // since these are end-to-end tests requiring browsers.
    include: isUnit ? [] : ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
