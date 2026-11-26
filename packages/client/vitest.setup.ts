/**
 * Vitest setup file for client package tests
 *
 * Sets up jsdom with napi-rs/canvas and fake-indexeddb support for Node.js testing
 */

import { afterAll } from 'vitest';
import { setupBrowserEnvironment, teardownBrowserEnvironment } from '@quake2ts/test-utils';

setupBrowserEnvironment({
  enableWebGL2: true, // Assuming client might need it
  enablePointerLock: true
});

// Clean up browser environment after all tests to prevent memory leaks
afterAll(() => {
  teardownBrowserEnvironment();
});
