/**
 * Sets up a Node.js environment for testing.
 * This is useful for packages that don't need browser mocks but might need
 * other Node-specific setups (like specific polyfills not provided by default).
 */

export interface NodeSetupOptions {
  // Add any specific Node environment options here if needed in future
}

export function setupNodeEnvironment(options: NodeSetupOptions = {}) {
  // Currently, most Node setup is handled by Vitest default environment
  // or specific polyfills in other helpers.
  // This function acts as a placeholder and standard entry point.

  // Example: Ensure global TextEncoder/TextDecoder if missing (Node 10-)
  if (typeof global.TextEncoder === 'undefined') {
    const { TextEncoder, TextDecoder } = require('util');
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;
  }
}
