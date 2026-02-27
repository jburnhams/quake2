import { defineConfig } from 'vitest/config';
import path from 'path';

const testType = process.env.TEST_TYPE;
const isWebGPU = testType === 'webgpu';
const isWebGL = testType === 'webgl';
const isIntegration = testType === 'integration';
const isUnitNode = testType === 'unit-node';
const isUnitJsdom = testType === 'unit-jsdom';
const isUnit = testType === 'unit';

const exclude = [
  '**/node_modules/**',
  '**/dist/**',
];

let include = ['tests/**/*.test.ts'];

if (isWebGPU) {
  include = ['tests/webgpu/**/*.test.ts'];
} else if (isWebGL) {
  include = ['tests/webgl/**/*.test.ts'];
} else if (isIntegration) {
  include = ['tests/unit-node/integration/**/*.test.ts'];
} else if (isUnitNode) {
  include = ['tests/unit-node/**/*.test.ts'];
} else if (isUnitJsdom) {
  include = ['tests/unit-jsdom/**/*.test.ts'];
} else if (isUnit) {
  include = ['tests/unit-node/**/*.test.ts', 'tests/unit-jsdom/**/*.test.ts'];
} else {
  // Default run (e.g. IDE or plain vitest) - run everything EXCEPT webgpu/webgl unless specified
  exclude.push('tests/webgpu/**');
  exclude.push('tests/webgl/**');
  // Also exclude tests/render/webgpu if it exists (legacy location)
  exclude.push('tests/render/webgpu/**');
}

const setupFiles = ['./vitest.setup.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared/': path.resolve(__dirname, '../shared/src') + '/',
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/engine/': path.resolve(__dirname, './src') + '/',
      '@quake2ts/engine': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/test-utils/src/engine/mocks/webgpu': path.resolve(__dirname, '../test-utils/src/engine/mocks/webgpu.ts'),
      '@quake2ts/test-utils/src/setup/webgpu': path.resolve(__dirname, '../test-utils/src/setup/webgpu.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
      '@quake2ts/bsp-tools': path.resolve(__dirname, '../bsp-tools/src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    environment: isUnitNode ? 'node' : 'jsdom',
    setupFiles,
    globals: true,
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
    } : {}),
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
