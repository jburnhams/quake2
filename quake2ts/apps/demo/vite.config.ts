import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  server: {
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@quake2ts/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@quake2ts/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
      '@quake2ts/game': path.resolve(__dirname, '../../packages/game/src/index.ts'),
      '@quake2ts/client': path.resolve(__dirname, '../../packages/client/src/index.ts'),
    },
  },
})
