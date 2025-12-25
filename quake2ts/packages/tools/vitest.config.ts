import { defineConfig } from 'vitest/config';
import path from 'path';

const isUnit = process.env.TEST_TYPE === 'unit';

export default defineConfig({
  test: {
    // Optimize unit test performance - tools package has stateless file processing
    ...(isUnit ? {
      pool: 'threads',
      isolate: false, // Safe for stateless file processing tools
    } : {}),
    alias: {
      '@quake2ts/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
