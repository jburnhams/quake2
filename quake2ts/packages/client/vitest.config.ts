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
  : ['tests/**/*.test.ts'];

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, '../cgame/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include,
    exclude,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
  },
});
