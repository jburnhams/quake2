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
    : ['tests/unit-node/**/*.test.ts']; // Default pattern for test-utils

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(import.meta.dirname, '../game/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(import.meta.dirname, './src/index.ts'),
      '@quake2ts/server': path.resolve(import.meta.dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      '@quake2ts/client': path.resolve(import.meta.dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(import.meta.dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    // Optimize unit test performance with threads and no isolation
    ...(isUnit ? {
      pool: 'threads',
      isolate: false,
    } : {}),
    // Force sequential execution for integration and webgpu tests
    ...((isIntegration || isWebGPU || isWebGL) ? {
      pool: 'forks',
      maxWorkers: 1,
      isolate: true,
      fileParallelism: false
    } : {})
  },
});
