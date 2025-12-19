import { setupBrowserEnvironment } from '@quake2ts/test-utils';
import { createCanvas } from '@napi-rs/canvas';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

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

// Re-export specific helpers used by tests
export { createMockWebGL2Context, MockPointerLock } from '@quake2ts/test-utils';

export function createHeadlessCanvas(width: number, height: number) {
    return createCanvas(width, height);
}
