import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  ...(isUnit ? ['**/integration/**', '**/*integration*', '**/performance/**'] : [])
];

const include = isIntegration
  ? ['**/integration/**', '**/*integration*']
  : ['tests/**/*.test.ts', 'src/save/tests/**/*.test.ts'];

export default defineConfig({
  test: {
    include,
    exclude,
    // pool: 'forks', // Default is threads, which is faster but might have isolation issues. Forks provides better isolation.
    // Let's stick to forks but allow parallelism.
    pool: isIntegration ? 'forks' : 'threads',
    poolOptions: {
      forks: {
        ...(isIntegration ? { maxForks: 1, minForks: 1 } : {}),
      },
    },
    fileParallelism: !isIntegration,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    teardownTimeout: 1000,
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
    },
  },
});
