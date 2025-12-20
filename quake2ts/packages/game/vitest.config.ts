import { defineConfig } from 'vitest/config';
import path from 'path';

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

export default defineConfig({
  test: {
    include,
    exclude,
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    fileParallelism: false,
    isolate: true,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    teardownTimeout: 1000,
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, './src/index.ts'),
    },
  },
});
