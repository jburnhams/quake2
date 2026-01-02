import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/webgpu/**/*.test.ts'],
    environment: 'node', // WebGPU tests often run in node with headless-gl/webgpu provider or custom
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
