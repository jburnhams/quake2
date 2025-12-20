import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    fileParallelism: false,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    teardownTimeout: 1000,
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
  },
});
