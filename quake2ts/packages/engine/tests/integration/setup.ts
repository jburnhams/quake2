import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { createCanvas } from '@napi-rs/canvas';

/**
 * Sets up a browser environment for testing using JSDOM and napi-rs/canvas.
 * Uses configuration suitable for the general tests package.
 */
export function setupBrowserEnvironmentLocal() {
    setupBrowserEnvironment({
        url: 'http://localhost:3000/',
        pretendToBeVisual: true,
        resources: 'usable',
        enableWebGL2: true,
        enablePointerLock: true
    });
}

// Rename the export to match what was likely imported by other files
export { setupBrowserEnvironmentLocal as setupBrowserEnvironment };

// Re-export specific helpers used by tests from test-utils
export { createMockWebGL2Context, MockPointerLock, createMockPointerLock, createInputInjector } from '@quake2ts/test-utils';

/**
 * Creates a headless canvas using napi-rs/canvas.
 * Prefer using test-utils factories in new code.
 */
export function createHeadlessCanvas(width: number, height: number) {
    return createCanvas(width, height);
}
