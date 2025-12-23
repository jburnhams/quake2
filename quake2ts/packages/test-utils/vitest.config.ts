import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  // Exclude WebGPU tests from unit tests - they require real GPU drivers
  ...(isUnit ? ['tests/webgpu-headless.test.ts', 'tests/webgpu-rendering.test.ts'] : [])
];

export default defineConfig({
  test: {
    exclude,
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
    // Optimize unit test performance with threads
    ...(isUnit ? {
      pool: 'threads',
      isolate: true, // Ensure test isolation
    } : {}),
    // Force sequential execution for integration tests to prevent WebGPU native module crashes
    ...(isIntegration ? {
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
