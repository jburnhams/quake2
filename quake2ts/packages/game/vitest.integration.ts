import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/integration/**/*.test.ts'],
      pool: 'forks',
      poolOptions: {
        forks: {
          maxForks: 1,
          minForks: 1,
        },
      },
      fileParallelism: false,
    },
  })
);
