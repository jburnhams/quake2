import { defineConfig } from 'vitest/config';
import path from 'path';

const isWebGPU = process.env.TEST_TYPE === 'webgpu';
const isWebGL = process.env.TEST_TYPE === 'webgl';
const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  'tests/unit-node/**', // Exclude node-specific unit tests as they run with vitest.node.config.ts
  // Exclude webgpu specific tests from standard runs
  ...((!isWebGPU) ? ['**/webgpu/**/*.test.ts'] : []),
  // Exclude webgl visual tests from standard runs
  ...((!isWebGL) ? ['**/tests/webgl/**'] : []),
  // Exclude integration tests from unit tests
  ...(isUnit ? ['**/tests/integration/**', '**/performance/**'] : [])
];

const include = isWebGPU
  ? ['**/webgpu/**/*.test.ts']
  : isWebGL
    ? ['**/tests/webgl/**/*.test.ts']
    : isIntegration
      ? ['**/tests/integration/**/*.test.ts', '**/performance/**/*.test.ts']
      : ['tests/**/*.test.ts', 'test/**/*.test.ts'];

const setupFiles = ['./vitest.setup.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared/': path.resolve(__dirname, '../shared/src') + '/',
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/engine/': path.resolve(__dirname, './src') + '/',
      '@quake2ts/engine': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils/src/engine/mocks/webgpu': path.resolve(__dirname, '../test-utils/src/engine/mocks/webgpu.ts'),
      '@quake2ts/test-utils/src/setup/webgpu': path.resolve(__dirname, '../test-utils/src/setup/webgpu.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    environment: 'jsdom',
    setupFiles,
    globals: true,
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
