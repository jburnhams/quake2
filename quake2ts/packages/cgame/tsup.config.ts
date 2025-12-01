import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    resolve: true,
  },
  sourcemap: true,
  clean: true,
  treeshake: false, // Disable treeshaking to prevent missing files/exports
  splitting: false, // Disable code splitting to bundle everything into index.js
  tsconfig: './tsconfig.build.json',
});
