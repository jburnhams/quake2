import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Server',
    browserBundle: false, // Server package doesn't need browser bundle
    external: [/@quake2ts\/.*/, 'gl-matrix', 'ws'],
  })
);
