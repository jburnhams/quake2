import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The labs show id's original source beside the port's (src/labs/source), read with ?raw from
// .id-source, which this fetches if it is missing (a no-op once it is there).
execFileSync('sh', [fileURLToPath(new URL('../../scripts/fetch-id-source.sh', import.meta.url)), 'full', 'rerelease'], {
  stdio: ['ignore', 'ignore', 'inherit'],
});

// The explorer is served from a sub-path on GitHub Pages, so every URL is relative to BASE_URL.
export default defineConfig({
  base: process.env.EXPLORER_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
  },
});
