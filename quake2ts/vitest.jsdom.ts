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
      { find: '@quake2ts/test-utils', replacement: path.resolve(__dirname, 'packages/test-utils/src/index.ts') },
    ],
  },
  test: {
    environment: 'jsdom',
    include: [
      'packages/engine/tests/**/*.test.ts',
      'packages/client/tests/**/*.test.ts',
      // Include src tests if any
      'packages/engine/src/**/*.test.ts',
      'packages/client/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/e2e-tests/**',
      '**/performance/**',
      '**/integration/**',
      '**/*integration*',
      '**/webgpu/**',
      '**/webgl/**',
      // Exclude asset preview tests that require Node environment
      'packages/engine/tests/assets/preview.test.ts',
      'packages/engine/tests/assets/preview_bounds.test.ts',
      'packages/client/tests/unit-node/**/*.test.ts',
    ],
    pool: 'threads',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit-jsdom.xml',
    },
    // Only clear mock history, do not reset implementations as engine tests rely on persistent mocks
    clearMocks: true,
  },
});
