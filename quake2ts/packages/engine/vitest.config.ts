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
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
