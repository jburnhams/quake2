import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    target: 'es2020',
    sourcemap: true,
    clean: true,
    splitting: false,
    dts: false,
    outDir: 'dist/esm'
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'es2020',
    sourcemap: true,
    clean: false,
    splitting: false,
    dts: false,
    outDir: 'dist/cjs',
    outExtension() {
      return { js: '.cjs' };
    }
  },
  {
    entry: { index: 'src/index.ts' },
    format: ['iife'],
    target: 'es2020',
    sourcemap: true,
    clean: false,
    splitting: false,
    dts: false,
    outDir: 'dist/browser',
    globalName: 'Quake2Shared',
    minify: true,
    platform: 'browser'
  }
]);
