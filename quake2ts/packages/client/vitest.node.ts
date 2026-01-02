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
      // Self-reference aliases
      { find: /^@quake2ts\/client$/, replacement: path.resolve(__dirname, 'src/index.ts') },
      { find: /^@quake2ts\/client\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'tests/unit-node/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/unit-jsdom/**',
      'tests/integration/**',
    ],
    pool: 'threads',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-node.xml',
    },
    // Ensure mocks are reset between tests
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
