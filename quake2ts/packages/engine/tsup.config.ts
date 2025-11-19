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
    // Bundle all workspace dependencies for self-contained subpath exports
    noExternal: ['@quake2ts/shared']
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
    // Bundle all workspace dependencies for self-contained subpath exports
    noExternal: ['@quake2ts/shared'],
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
    globalName: 'Quake2Engine',
    minify: true,
    platform: 'browser',
    // Bundle all workspace dependencies for browser usage
    noExternal: ['@quake2ts/shared']
  }
]);
