import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/webgl/**/*.test.ts'],
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1
      }
    },
    // Disable isolation to allow sharing the Playwright browser instance across test files
    isolate: false,
    fileParallelism: false
  },
}));
