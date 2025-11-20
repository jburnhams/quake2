import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const sharedSrc = fileURLToPath(new URL('../shared/src/index.ts', import.meta.url));
const gameSrc = fileURLToPath(new URL('../game/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/shared': sharedSrc,
      '@quake2ts/game': gameSrc,
    },
  },
  test: {
    environment: 'jsdom',
  },
});
