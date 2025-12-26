import { defineConfig, Options } from 'tsup';

interface PackageConfig {
  /** Package name for browser global (e.g., "Quake2Shared") */
  globalName: string;
  /** Entry point (default: 'src/index.ts') */
  entry?: string;
  /** External dependencies to keep unbundled in ESM/CJS builds */
  external?: string[];
  /** Whether to generate browser IIFE bundle (default: true) */
  browserBundle?: boolean;
}

/**
 * Creates a standardized library build configuration for quake2ts packages.
 *
 * Generates three builds:
 * 1. ESM - Tree-shakeable ES module format (dependencies external)
 * 2. CJS - CommonJS format (dependencies external)
 * 3. Browser IIFE - Self-contained minified bundle (all dependencies bundled)
 *
 * Best practices:
 * - ESM/CJS keep workspace and external deps external for tree-shaking
 * - Browser IIFE bundles everything for standalone CDN usage
 * - Types are generated separately via tsc -b
 */
export function createLibraryConfig(config: PackageConfig): Options[] {
  const entry = config.entry || 'src/index.ts';
  const browserBundle = config.browserBundle !== false;

  // Default externals: all workspace packages + common external deps
  const defaultExternal = [
    /@quake2ts\/.*/,
    'gl-matrix',
    'ws',
    '@wasm-audio-decoders/ogg-vorbis',
  ];
  const external = config.external || defaultExternal;

  const builds: Options[] = [
    // ESM build - keep dependencies external for tree-shaking
    {
      entry: [entry],
      format: ['esm'],
      target: 'es2020',
      sourcemap: true,
      clean: true,
      splitting: false,
      dts: false, // Types generated separately via tsc -b
      outDir: 'dist/esm',
      external,
      treeshake: true,
    },

    // CJS build - keep dependencies external
    {
      entry: [entry],
      format: ['cjs'],
      target: 'es2020',
      sourcemap: true,
      clean: false,
      splitting: false,
      dts: false,
      outDir: 'dist/cjs',
      external,
      treeshake: true,
      outExtension() {
        return { js: '.cjs' };
      },
    },
  ];

  // Optional browser IIFE bundle - bundle everything for standalone usage
  if (browserBundle) {
    builds.push({
      entry: { index: entry },
      format: ['iife'],
      target: 'es2020',
      sourcemap: true,
      clean: false,
      splitting: false,
      dts: false,
      outDir: 'dist/browser',
      globalName: config.globalName,
      minify: true,
      platform: 'browser',
      // Bundle ALL dependencies for self-contained browser usage
      noExternal: [/.*/],
    });
  }

  return builds;
}
