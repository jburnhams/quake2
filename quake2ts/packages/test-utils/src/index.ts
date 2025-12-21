// Export all test utilities
export * from './shared/mocks.js';
export * from './shared/bsp.js';
export * from './shared/math.js';
export * from './shared/collision.js';
export * from './shared/factories.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './game/helpers/physics.js';
export * from './game/mocks/ai.js';
export * from './game/mocks/combat.js';
export * from './game/mocks/items.js';
export * from './game/mocks.js';
export * from './server/mocks/transport.js';
export * from './server/mockTransport.js';
export * from './server/mocks/state.js';
export * from './server/mocks/connection.js';
export * from './server/mocks/commands.js';
export * from './server/mocks/master.js';
export * from './server/mocks/physics.js';
export * from './server/helpers/multiplayer.js';
export * from './server/helpers/snapshot.js';
export * from './server/helpers/bandwidth.js';

// Setup
export * from './setup/browser.js';
export * from './setup/canvas.js';
export * from './engine/mocks/webgpu.js';
export * from './setup/timing.js';
export * from './setup/node.js';
export * from './engine/mocks/webgl.js'; // Restored original export
export * from './engine/rendering.js'; // Rendering mocks (does not re-export webgl symbols now)
export * from './setup/storage.js';
export * from './setup/audio.js';

// Client Mocks
export * from './client/mocks/input.js';
export * from './client/helpers/view.js';

// E2E
export * from './e2e/playwright.js';
// export * from './e2e/input.js'; // Replaced by client/mocks/input.js
export * from './e2e/network.js';
export * from './e2e/visual.js';

// Export types
export type { BrowserSetupOptions } from './setup/browser.js';
export type { NodeSetupOptions } from './setup/node.js';
export type { MockRAF } from './setup/timing.js';
export type { StorageScenario } from './setup/storage.js';
export type { NetworkSimulator, NetworkCondition } from './e2e/network.js';
export type { VisualScenario, VisualDiff } from './e2e/visual.js';
