import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@quake2ts/shared', replacement: path.resolve(import.meta.dirname, '../shared/src/index.ts') },
      { find: '@quake2ts/engine', replacement: path.resolve(import.meta.dirname, '../engine/src/index.ts') },
      { find: '@quake2ts/game', replacement: path.resolve(import.meta.dirname, '../game/src/index.ts') },
      { find: '@quake2ts/cgame', replacement: path.resolve(import.meta.dirname, '../cgame/src/index.ts') },
      { find: '@quake2ts/server', replacement: path.resolve(import.meta.dirname, '../server/src/index.ts') },
      { find: '@quake2ts/test-utils', replacement: path.resolve(import.meta.dirname, '../test-utils/src/index.ts') },
      { find: /^@quake2ts\/client$/, replacement: path.resolve(import.meta.dirname, 'src/index.ts') },
      { find: /^@quake2ts\/client\/(.*)/, replacement: path.resolve(import.meta.dirname, 'src/$1') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: [
      'tests/unit-jsdom/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit-node/**',
      'tests/integration/**',
    ],
    setupFiles: ['./vitest.setup.ts'],
    pool: 'threads',
    isolate: false,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-jsdom.xml',
    },
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
