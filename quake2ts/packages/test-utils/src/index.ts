// Export all test utilities
export * from './shared/mocks.js';
export * from './shared/bsp.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './game/mock-game.js';
export * from './engine/rendering.js';
export * from './setup/browser.js';
export * from './setup/node.js';
export * from './setup/webgl.js';
export * from './setup/canvas.js';
export * from './setup/timing.js';
export * from './setup/storage.js';
export * from './setup/audio.js';
export * from './e2e/input.js';
export * from './e2e/playwright.js';
export * from './e2e/network.js';
export * from './e2e/visual.js';

// Re-export types that might be needed
export type { BrowserSetupOptions } from './setup/browser.js';
export type { MockRAF, ControlledTimer } from './setup/timing.js';
export type { PlaywrightOptions, PlaywrightTestClient } from './e2e/playwright.js';
export type { StorageScenario } from './setup/storage.js';
export type { AudioEvent } from './setup/audio.js';
export type { NetworkSimulator, NetworkCondition } from './e2e/network.js';
export type { VisualDiff, VisualScenario } from './e2e/visual.js';
