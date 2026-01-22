import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensure assets are loaded relatively for GitHub Pages
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Resolve quake2ts packages to their built ESM modules
      "@quake2ts/engine": path.resolve(__dirname, "../quake2ts/packages/engine/dist/esm/index.js"),
      "@quake2ts/client": path.resolve(__dirname, "../quake2ts/packages/client/dist/esm/index.js"),
      "@quake2ts/shared": path.resolve(__dirname, "../quake2ts/packages/shared/dist/esm/index.js"),
      "@quake2ts/cgame": path.resolve(__dirname, "../quake2ts/packages/cgame/dist/esm/index.js"),
      "@quake2ts/game": path.resolve(__dirname, "../quake2ts/packages/game/dist/esm/index.js"),
    },
  },
  optimizeDeps: {
    include: ['gl-matrix'],
  },
})
