import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, 'packages/engine/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, 'packages/game/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, 'packages/cgame/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, 'packages/server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, 'packages/client/src/index.ts'),
      '@quake2ts/test-utils/shared/bsp': path.resolve(__dirname, 'packages/test-utils/src/shared/bsp.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, 'packages/test-utils/src/index.ts'),
      '@quake2ts/test-utils/src/engine/mocks/webgpu': path.resolve(__dirname, 'packages/test-utils/src/engine/mocks/webgpu.ts'),
      '@quake2ts/test-utils/src/setup/webgpu': path.resolve(__dirname, 'packages/test-utils/src/setup/webgpu.ts'),
    },
  },
  test: {
    environment: 'node',
    include: [
      'packages/game/tests/**/*.test.ts',
      'packages/server/tests/**/*.test.ts',
      'packages/shared/tests/**/*.test.ts',
      'packages/test-utils/tests/**/*.test.ts',
      'packages/cgame/tests/**/*.test.ts',
      // Asset processing tests that require Node environment (Buffer/DataView compatibility)
      'packages/engine/tests/assets/preview.test.ts',
      'packages/engine/tests/assets/preview_bounds.test.ts',
      // Include src tests if any
      'packages/game/src/**/*.test.ts',
      'packages/shared/src/**/*.test.ts',
      'packages/cgame/src/**/*.test.ts',
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
