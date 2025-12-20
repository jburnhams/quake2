// Export all test utilities
// This is the main entry point for the test-utils package

// Shared Utilities (Section 19-1)
export * from './shared/bsp.js';
export * from './shared/mocks.js';
// export * from './shared/math.js'; // To be implemented
// export * from './shared/collision.js'; // To be implemented
// export * from './shared/factories.js'; // To be implemented

// Game Utilities (Section 19-3)
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './game/helpers/physics.js';
export * from './game/mocks/ai.js';
export * from './game/mocks/combat.js';
export * from './game/mocks/items.js';

// Engine Utilities (Section 19-2)
export * from './engine/mocks/webgpu.js';
// export * from './engine/index.js'; // To be implemented

// Client Utilities (Section 19-4)
export * from './client/helpers/view.js';
export * from './client/mocks/input.js';

// Server Utilities (Section 19-5)
export * from './server/helpers/multiplayer.js';
export * from './server/helpers/snapshot.js';
export * from './server/helpers/bandwidth.js';
export * from './server/mocks/commands.js';
export * from './server/mocks/transport.js';
export * from './server/mocks/master.js';
export * from './server/mocks/state.js';
export * from './server/mocks/physics.js';
export * from './server/mocks/connection.js';

// Setup Utilities (Section 19-6)
export * from './setup/browser.js';
// export * from './setup/webgl.js'; // Duplicates createMockWebGL2Context from mocks/webgl2.js
export * from './setup/canvas.js';
export * from './engine/mocks/webgpu.js';
export * from './engine/mocks/webgl.js'; // Consolidated export
export * from './setup/storage.js';
export * from './setup/timing.js';
export * from './setup/audio.js';
export * from './setup/node.js';

// E2E Utilities (Section 19-6)
export * from './e2e/playwright.js';
export * from './e2e/visual.js';
export * from './e2e/network.js';

// Legacy/Misc
export * from './mocks/webgl2.js';
