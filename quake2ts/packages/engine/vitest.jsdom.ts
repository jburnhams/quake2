import { defineConfig, mergeConfig } from 'vitest/config';
import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, defineConfig({
  test: {
    include: ['tests/unit-jsdom/**/*.test.ts'],
    environment: 'jsdom',
  },
}));
