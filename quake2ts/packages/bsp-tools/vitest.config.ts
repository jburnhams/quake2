import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@quake2ts/test-utils': path.resolve(__dirname, '../test-utils/src/index.ts'),
      '@quake2ts/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      '@quake2ts/bsp-tools': path.resolve(__dirname, './src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit-node/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    pool: 'threads',
    isolate: false,
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    environment: 'node',
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results/junit.xml',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60
      },
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts']
    }
  },
});
