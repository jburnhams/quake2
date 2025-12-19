/**
 * Sets up a Node.js environment for testing.
 * This is primarily for backend or shared logic that doesn't rely on browser APIs.
 */
export function setupNodeEnvironment() {
  // Add any Node-specific global setup here
  // For now, this is a placeholder or can be used for things like
  // polyfilling fetch if not present in older Node versions (though Quake2TS targets recent Node)

  if (typeof global.fetch === 'undefined') {
      // In a real scenario, we might import node-fetch here
      // global.fetch = ...
  }
}
