import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['tests/unit-node/**/*.test.ts'],
      environment: 'node',
      pool: 'threads',
      poolOptions: {
        threads: {
          maxThreads: 2,
          minThreads: 1
        }
      }
    },
  })
);
