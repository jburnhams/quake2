import { defineConfig } from 'vitest/config';
import baseConfig from './vitest.config';

// We want to reuse resolve/alias and some settings, but strictly control include/exclude
export default defineConfig({
  ...baseConfig, // Shallow copy top level
  test: {
    ...baseConfig.test, // Shallow copy test options
    include: ['tests/unit-node/**/*.test.ts'], // Override include
    exclude: ['**/node_modules/**', '**/dist/**'], // Override exclude to be simple
    environment: 'node',
  },
});
