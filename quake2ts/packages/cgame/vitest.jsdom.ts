import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../game/src/index.ts'),
      '@quake2ts/cgame': path.resolve(__dirname, './src/index.ts'),
      '@quake2ts/server': path.resolve(__dirname, '../server/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../client/src/index.ts'),
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/unit-jsdom/**/*.test.ts'],
  },
});
