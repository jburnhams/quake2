import { defineConfig } from 'tsup';
import { createLibraryConfig } from '../../build-config/tsup.factory';

export default defineConfig(
  createLibraryConfig({
    globalName: 'Quake2Shared',
    browserBundle: true,
    // Only external dependency is gl-matrix (used in types but not bundled)
    external: ['gl-matrix'],
  })
);
