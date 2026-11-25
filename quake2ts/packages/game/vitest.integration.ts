import { defineConfig } from 'vitest/config';
import path from 'path';

const include = ['tests/integration/**/*.test.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(import.meta.dirname, './src/index.ts'),
      '@quake2ts/test-utils': path.resolve(import.meta.dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(import.meta.dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      '@quake2ts/client': path.resolve(import.meta.dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(import.meta.dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    teardownTimeout: 1000,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-integration.xml',
    },
  },
});
