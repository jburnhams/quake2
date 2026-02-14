import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@quake2ts/shared', replacement: path.resolve(__dirname, 'packages/shared/src/index.ts') },
      { find: '@quake2ts/engine', replacement: path.resolve(__dirname, 'packages/engine/src/index.ts') },
      { find: '@quake2ts/game', replacement: path.resolve(__dirname, 'packages/game/src/index.ts') },
      { find: '@quake2ts/cgame', replacement: path.resolve(__dirname, 'packages/cgame/src/index.ts') },
      { find: '@quake2ts/server', replacement: path.resolve(__dirname, 'packages/server/src/index.ts') },
      // Exact match for client package entry
      { find: /^@quake2ts\/client$/, replacement: path.resolve(__dirname, 'packages/client/src/index.ts') },
      // Wildcard match for deep imports in client package
      { find: /^@quake2ts\/client\/(.*)/, replacement: path.resolve(__dirname, 'packages/client/src/$1') },

      { find: '@quake2ts/test-utils/src/engine/mocks/webgpu', replacement: path.resolve(__dirname, 'packages/test-utils/src/engine/mocks/webgpu.ts') },
      { find: '@quake2ts/test-utils/src/setup/webgpu', replacement: path.resolve(__dirname, 'packages/test-utils/src/setup/webgpu.ts') },
      { find: '@quake2ts/test-utils/mocks/projectiles', replacement: path.resolve(__dirname, 'packages/test-utils/src/game/mocks/projectiles.ts') },
      { find: '@quake2ts/test-utils/mocks/damage', replacement: path.resolve(__dirname, 'packages/test-utils/src/game/mocks/damage.ts') },
      { find: '@quake2ts/test-utils', replacement: path.resolve(__dirname, 'packages/test-utils/src/index.ts') },
      { find: '@quake2ts/bsp-tools', replacement: path.resolve(__dirname, 'packages/bsp-tools/src/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: [
      'packages/bsp-tools/tests/**/*.test.ts',
      'packages/game/tests/**/*.test.ts',
      'packages/server/tests/**/*.test.ts',
      'packages/shared/tests/**/*.test.ts',
      'packages/test-utils/tests/**/*.test.ts',
      'packages/cgame/tests/unit-node/**/*.test.ts',
      // Engine unit-node tests
      'packages/engine/tests/unit-node/**/*.test.ts',
      // Include src tests if any
      'packages/game/src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
      'packages/cgame/src/**/*.test.ts',
      'packages/bsp-tools/src/**/*.test.ts',
      // Also include client tests that run in node
      'packages/client/tests/unit-node/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/e2e-tests/**',
      '**/performance/**',

      // Exclude JSDOM/Browser integration tests, but allow Node.js integration tests in unit-node
      'packages/game/tests/integration/**',
      'packages/server/tests/integration/**',
      'packages/engine/tests/integration/**',
      'packages/client/tests/integration/**',
      'packages/engine/tests/render/integration/**',

      'packages/engine/tests/webgpu/**', // Only exclude the specific webgpu test folder, not unit mocks
      'packages/test-utils/tests/webgpu/**', // Exclude test-utils webgpu tests which crash in this env
      '**/webgl/**',
    ],
    pool: 'threads',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-node.xml',
    },
    // Ensure mocks are reset between tests to prevent state leakage
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
  },
});
