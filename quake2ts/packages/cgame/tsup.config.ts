import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Using tsc for declaration generation
  sourcemap: true,
  clean: true,
  treeshake: true,
  tsconfig: './tsconfig.json',
});
