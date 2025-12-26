import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Engine',
    browserBundle: true,
    external: [
      /@quake2ts\/.*/,
      'gl-matrix',
      '@wasm-audio-decoders/ogg-vorbis',
    ],
  })
);
