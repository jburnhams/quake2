import { fileURLToPath } from 'node:url';
import { searchForWorkspaceRoot } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The explorer is served from a sub-path on GitHub Pages, so every URL is relative to BASE_URL.
export default defineConfig({
  base: process.env.EXPLORER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  // The labs show id's original source beside the port's (src/labs/source), read with ?raw from the
  // repository's own copies, which sit outside the pnpm workspace.
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        fileURLToPath(new URL('../../../rerelease', import.meta.url)),
        fileURLToPath(new URL('../../../full', import.meta.url)),
      ],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
