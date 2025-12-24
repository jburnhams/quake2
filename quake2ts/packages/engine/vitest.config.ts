import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'path';

const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const gameSrc = fileURLToPath(new URL('../game/src/index.ts', import.meta.url));

const isWebGPU = process.env.TEST_TYPE === 'webgpu';
const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  // Exclude webgpu specific tests from standard runs
  ...((!isWebGPU) ? ['**/tests/webgpu/**'] : []),
  // Exclude integration tests from unit tests
  ...(isUnit ? ['**/integration/**', '**/*integration*', '**/performance/**'] : [])
];

const include = isWebGPU
  ? ['**/tests/webgpu/**/*.test.ts']
  : isIntegration
    ? ['**/integration/**', '**/*integration*', '**/performance/**']
    : ['tests/**/*.test.ts', 'test/**/*.test.ts'];

const setupFiles = ['./vitest.setup.ts'];
// Remove setup-webgpu.ts from standard runs, it's specific to webgpu tests or if needed for mocks
// If mocks are needed for integration/unit, ensure they don't trigger real webgpu init
if (isIntegration && !isWebGPU) {
    // If there are other integration tests needing mocks but not real webgpu:
    // setupFiles.push('./tests/setup-webgpu.ts');
    // BUT the goal is to split real webgpu.
    // Assuming setup-webgpu.ts was the one triggering real usage?
    // Let's keep it clean.
}

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': sharedSrc,
      '@quake2ts/game': gameSrc,
      '@quake2ts/engine': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils/src/engine/mocks/webgpu': path.resolve(__dirname, '../test-utils/src/engine/mocks/webgpu.ts'),
      '@quake2ts/test-utils/src/setup/webgpu': path.resolve(__dirname, '../test-utils/src/setup/webgpu.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    environment: 'jsdom',
    setupFiles,
    globals: true,
     // Optimize unit test performance
    ...(isUnit ? {
      pool: 'threads',
      isolate: false,
    } : {}),
    // Force sequential execution for integration and webgpu tests
    ...((isIntegration || isWebGPU) ? {
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 1,
          minForks: 1
        }
      },
      isolate: true,
      fileParallelism: false
    } : {})
  },
});
