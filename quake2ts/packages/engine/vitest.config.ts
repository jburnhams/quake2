import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'path';

const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const gameSrc = fileURLToPath(new URL('../game/src/index.ts', import.meta.url));

const isWebGPU = process.env.TEST_TYPE === 'webgpu';
const isWebGL = process.env.TEST_TYPE === 'webgl';
const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  // Exclude webgpu specific tests from standard runs
  ...((!isWebGPU) ? ['**/tests/webgpu/**'] : []),
  // Exclude webgl visual tests from standard runs
  ...((!isWebGL) ? ['**/tests/webgl/**'] : []),
  // Exclude integration tests from unit tests
  ...(isUnit ? ['**/integration/**', '**/*integration*', '**/performance/**'] : [])
];

const include = isWebGPU
  ? ['**/tests/webgpu/**/*.test.ts']
  : isWebGL
    ? ['**/tests/webgl/**/*.test.ts']
    : isIntegration
      ? ['**/integration/**', '**/*integration*', '**/performance/**']
      : ['tests/**/*.test.ts', 'test/**/*.test.ts'];

const setupFiles = ['./vitest.setup.ts'];

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
    // Force sequential execution for integration, webgpu, and webgl tests
    ...((isIntegration || isWebGPU || isWebGL) ? {
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 1,
          minForks: 1
        }
      },
      isolate: true,
      fileParallelism: false
    } : {}),
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
