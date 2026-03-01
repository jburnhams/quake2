import { defineConfig } from 'vitest/config';
import path from 'path';

const testType = process.env.TEST_TYPE;
const isIntegration = testType === 'integration';
const isUnitNode = testType === 'unit-node';
const isUnitJsdom = testType === 'unit-jsdom';
const isUnit = testType === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
];

let include = ['tests/**/*.test.ts', 'src/save/tests/**/*.test.ts'];

if (isIntegration) {
  include = ['tests/integration/**/*.test.ts'];
} else if (isUnitNode) {
  include = ['tests/unit-node/**/*.test.ts'];
} else if (isUnitJsdom) {
  include = ['tests/unit-jsdom/**/*.test.ts'];
} else if (isUnit) {
  exclude.push('tests/integration/**');
  exclude.push('**/*integration*');
}

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils/mocks/projectiles': path.resolve(__dirname, '../test-utils/src/game/mocks/projectiles.ts'),
      '@quake2ts/test-utils/mocks/damage': path.resolve(__dirname, '../test-utils/src/game/mocks/damage.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
      '@quake2ts/bsp-tools': path.resolve(__dirname, '../bsp-tools/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    environment: isUnitNode ? 'node' : 'jsdom',
    pool: isIntegration ? 'forks' : 'threads',
    poolOptions: {
      forks: {
        ...(isIntegration ? { maxForks: 1, minForks: 1 } : {}),
      },
    },
    fileParallelism: !isIntegration,
    isolate: false,
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
