import { defineConfig } from 'vitest/config';
import path from 'path';

const setupFiles = ['./vitest.setup.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared/': path.resolve(__dirname, '../shared/src') + '/',
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/engine/': path.resolve(__dirname, './src') + '/',
      '@quake2ts/engine': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include: ['tests/webgl/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'jsdom',
    setupFiles,
    globals: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1
      }
    },
    isolate: true,
    fileParallelism: false,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-webgl.xml',
    },
  },
});
