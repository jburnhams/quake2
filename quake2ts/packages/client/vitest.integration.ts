import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@quake2ts/shared', replacement: path.resolve(__dirname, '../shared/src/index.ts') },
      { find: '@quake2ts/engine', replacement: path.resolve(__dirname, '../engine/src/index.ts') },
      { find: '@quake2ts/game', replacement: path.resolve(__dirname, '../game/src/index.ts') },
      { find: '@quake2ts/cgame', replacement: path.resolve(__dirname, '../cgame/src/index.ts') },
      { find: '@quake2ts/server', replacement: path.resolve(__dirname, '../server/src/index.ts') },
      { find: '@quake2ts/test-utils', replacement: path.resolve(__dirname, '../test-utils/src/index.ts') },
      { find: /^@quake2ts\/client$/, replacement: path.resolve(__dirname, 'src/index.ts') },
      { find: /^@quake2ts\/client\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: [
      'tests/integration/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit-node/**',
      'tests/unit-jsdom/**',
    ],
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    isolate: false,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-integration.xml',
    },
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 20000,
  },
});
