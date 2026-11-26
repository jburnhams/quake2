import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';
import { Plugin } from 'esbuild';
import fs from 'fs';
import path from 'path';

const rawPlugin: Plugin = {
  name: 'raw-plugin',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, args => {
      return {
        path: path.resolve(args.resolveDir, args.path.slice(0, -4)),
        namespace: 'raw-loader',
      };
    });

    build.onLoad({ filter: /.*/, namespace: 'raw-loader' }, async args => {
      return {
        contents: await fs.promises.readFile(args.path, 'utf8'),
        loader: 'text',
      };
    });
  },
};

const baseConfigs = createLibraryConfig({
  globalName: 'Quake2Engine',
  browserBundle: true,
  // @quake2ts/formats and the strata-* libraries are private workspace packages for now, so they
  // are bundled in rather than left as imports a consumer could not resolve.
  external: [
    /@quake2ts\/(?!formats)/,
    'gl-matrix',
    '@wasm-audio-decoders/ogg-vorbis',
  ],
});

// Add WGSL loader and raw plugin to all build configs
const configs = baseConfigs.map(config => ({
  ...config,
  loader: {
    ...config.loader,
    '.wgsl': 'text',
  },
  esbuildPlugins: [rawPlugin],
}));

export default defineConfig(configs);
