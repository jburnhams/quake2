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
    outDir: 'dist/esm',
    external: ['@quake2ts/shared', '@quake2ts/engine']
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
    external: ['@quake2ts/shared', '@quake2ts/engine'],
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
    globalName: 'Quake2Game',
    minify: true,
    platform: 'browser',
    // Bundle all dependencies for browser usage
    noExternal: ['@quake2ts/shared', '@quake2ts/engine']
  }
]);
