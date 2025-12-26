import { defineConfig } from 'vitest/config';
import path from 'path';

const isWebGPU = process.env.TEST_TYPE === 'webgpu';
const isWebGL = process.env.TEST_TYPE === 'webgl';
const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  // Exclude WebGPU tests from standard runs
  ...((!isWebGPU) ? ['**/tests/webgpu/**'] : []),
  // Exclude WebGL tests from standard runs
  ...((!isWebGL) ? ['**/tests/webgl/**'] : []),
];

const include = isWebGPU
  ? ['**/tests/webgpu/**/*.test.ts']
  : isWebGL
    ? ['**/tests/webgl/**/*.test.ts']
    : ['tests/**/*.test.ts']; // Default pattern for test-utils

export default defineConfig({
  test: {
    include,
    exclude,
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
    // Optimize unit test performance with threads and no isolation
    ...(isUnit ? {
      pool: 'threads',
      isolate: false,
    } : {}),
    // Force sequential execution for integration and webgpu tests
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
    } : {})
  },
});
