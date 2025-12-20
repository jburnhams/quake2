// Export all test utilities
// Use .js extensions for module resolution compatibility

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
// Remove export * from './e2e/input.js' to avoid duplicates.
// If E2E specific input helpers are needed, they should be exported explicitly here or renamed.
// export * from './e2e/input.js';

// Shared
export * from './shared/bsp.js';
export * from './shared/mocks.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './client/mocks/input.js';

// Mocks
// NOTE: mocks/webgl2.ts contains a duplicate createMockWebGL2Context.
// We rely on setup/webgl.ts as the primary source.
// If mocks/webgl2.ts contains other exports, they should be exported explicitly here.
// Currently it only contains the duplicate function, so we exclude it.
