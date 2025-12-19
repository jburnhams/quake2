// Export all test utilities
export * from './shared/mocks.js';
export * from './shared/bsp.js';
export * from './game/factories.js';
export * from './game/helpers.js';
export * from './setup/browser.js';
export * from './setup/node.js';
export * from './setup/webgl.js';
export * from './setup/canvas.js';
export * from './e2e/input.js';

// Re-export types that might be needed
export type { BrowserSetupOptions } from './setup/browser.js';
