/**
 * Vitest setup file for engine package tests
 *
 * Sets up jsdom with napi-rs/canvas and fake-indexeddb support for Node.js testing
 */

import { setupBrowserEnvironment } from '@quake2ts/test-utils';

setupBrowserEnvironment();
