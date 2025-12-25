export interface NodeSetupOptions {
  enableConsoleMocks?: boolean;
}

/**
 * Sets up a Node.js environment for testing.
 * This should be called in your vitest.setup.ts file for non-browser packages.
 */
export function setupNodeEnvironment(options: NodeSetupOptions = {}) {
  const { enableConsoleMocks = true } = options;

  if (enableConsoleMocks) {
    // Mock console methods to reduce noise during tests if needed
    // Currently relying on default behavior but can be extended
  }
}

export function teardownNodeEnvironment() {
  // Restore console or other globals if modified
}
