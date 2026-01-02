import { defineConfig } from 'vitest/config';
import path from 'path';

const aliases = {
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
};

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    include: ['tests/unit-jsdom/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/unit-jsdom.xml',
    },
  },
});
