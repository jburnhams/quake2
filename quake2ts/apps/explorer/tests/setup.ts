import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { installLayoutShims } from 'strata-react/testing';
import { cleanup } from '@testing-library/react';

// The decode tests run in Node, with no DOM to shim.
if (typeof Element !== 'undefined') installLayoutShims({ width: 1280, height: 800 });

/** The committed demo PAK, the same file the app serves from public/pak.pak. */
export const demoPak = readFileSync(resolve(import.meta.dirname, '../../../pak.pak'));

export const handlers = [
  http.get('*/pak.pak', () =>
    HttpResponse.arrayBuffer(demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer),
  ),
];

export const server = setupServer(...handlers);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  server.resetHandlers();
  if (typeof document !== 'undefined') cleanup();
});
afterAll(() => server.close());
