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
    noExternal: ['@quake2ts/shared', '@quake2ts/engine', '@quake2ts/game']
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
    noExternal: ['@quake2ts/shared', '@quake2ts/engine', '@quake2ts/game'],
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
    globalName: 'Quake2CGame',
    minify: true,
    platform: 'browser',
    noExternal: ['@quake2ts/shared', '@quake2ts/engine', '@quake2ts/game']
  }
]);
