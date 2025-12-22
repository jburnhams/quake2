import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'path';

const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const gameSrc = fileURLToPath(new URL('../game/src/index.ts', import.meta.url));

const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  ...(isUnit ? ['**/integration/**', '**/*integration*'] : [])
];

const include = isIntegration
  ? ['**/integration/**', '**/*integration*']
  : ['tests/**/*.test.ts', 'test/**/*.test.ts'];

const setupFiles = ['./vitest.setup.ts'];
if (isIntegration) {
    setupFiles.push('./tests/setup-webgpu.ts');
}

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': sharedSrc,
      '@quake2ts/game': gameSrc,
      '@quake2ts/engine': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils/src/engine/mocks/webgpu': path.resolve(__dirname, '../test-utils/src/engine/mocks/webgpu.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    // Use 'node' environment for headless WebGPU tests to avoid jsdom conflicts with node-webgpu
    // However, existing tests might rely on jsdom.
    // We can override per test file using // @vitest-environment node
    // or set default to node if most tests don't need DOM.
    // Given this is the engine package and we want headless WebGPU, 'node' is safer for those.
    // But other tests might need 'jsdom'.
    environment: 'jsdom',
    setupFiles,
    globals: true,
    // Force sequential execution for integration tests to prevent WebGPU/NAPI crashes
    ...(isIntegration ? {
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 1,
          minForks: 1
        }
      },
      fileParallelism: false
    } : {})
  },
});
