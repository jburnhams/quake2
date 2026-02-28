import { defineConfig } from 'vitest/config';
import path from 'path';

const isIntegration = process.env.TEST_TYPE === 'integration';
const isUnitNode = process.env.TEST_TYPE === 'unit-node';
const isUnit = process.env.TEST_TYPE === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
  ...((isUnit || isUnitNode) ? ['**/integration/**', '**/*integration*'] : [])
];

const include = isIntegration
  ? ['tests/unit-node/integration/**/*.test.ts', 'tests/**/*integration*.test.ts']
  : isUnitNode
    ? ['tests/unit-node/**/*.test.ts']
    : ['tests/**/*.test.ts', 'test/**/*.test.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    pool: 'forks',
    environment: 'node',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1,
      },
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
