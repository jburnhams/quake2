// Export all test utilities
export * from './shared/mocks.js';
export * from './shared/bsp.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './game/mocks.js';
export * from './server/mocks/transport.js';
export * from './server/mocks/state.js';
export * from './server/mocks/connection.js';
export * from './server/helpers/multiplayer.js';
export * from './server/helpers/snapshot.js';

// Setup
export * from './setup/browser.js';
export * from './setup/canvas.js';
export * from './setup/node.js';
export * from './setup/webgl.js'; // This exports createMockWebGL2Context
export * from './setup/storage.js';
export * from './setup/audio.js';
export * from './setup/timing.js';

// E2E
export * from './e2e/playwright.js';
export * from './e2e/input.js';

// Shared
export * from './shared/bsp.js';
export * from './shared/mocks.js';
export * from './game/factories.js';
export * from './game/helpers.js';

// Mocks
// NOTE: mocks/webgl2.ts contains a duplicate createMockWebGL2Context.
// We rely on setup/webgl.ts as the primary source.
// If mocks/webgl2.ts contains other exports, they should be exported explicitly here.
// Currently it only contains the duplicate function, so we exclude it.
