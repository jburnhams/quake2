import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'jsdom',
    pool: 'forks',
    maxWorkers: 1,
    isolate: true,
    fileParallelism: false
  },
}));
