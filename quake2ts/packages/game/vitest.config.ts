import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  // If unit tests, exclude integration folder
  ...(isUnit ? ['tests/integration/**', '**/*integration*'] : []),
  // If integration tests, exclude unit tests.
  // We exclude everything that is NOT in tests/integration
  // But include only allows specific files.
  // The 'exclude' list is applied after 'include'.
  // If include is ['tests/integration/**'], we don't strictly need exclude for others, but good for safety.
];

const include = isIntegration
  ? ['tests/integration/**/*.test.ts']
  : ['tests/**/*.test.ts', 'src/save/tests/**/*.test.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
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
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
