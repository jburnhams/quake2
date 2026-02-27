import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/unit-node/integration/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 1,
        minForks: 1
      }
    },
    isolate: true,
    fileParallelism: false
  },
}));
