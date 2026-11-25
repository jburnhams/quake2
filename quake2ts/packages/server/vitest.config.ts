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
      '@quake2ts/shared': path.resolve(import.meta.dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(import.meta.dirname, '../game/src/index.ts'),
      '@quake2ts/engine': path.resolve(import.meta.dirname, '../engine/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(import.meta.dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(import.meta.dirname, './src/index.ts'),
      '@quake2ts/client': path.resolve(import.meta.dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(import.meta.dirname, '../cgame/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    pool: 'forks',
    environment: 'node',
    maxWorkers: 1,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
