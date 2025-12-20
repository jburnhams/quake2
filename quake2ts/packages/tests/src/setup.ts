import { setupBrowserEnvironment as setupBrowserEnvironmentUtils } from '@quake2ts/test-utils';
import { createCanvas } from '@napi-rs/canvas';
import { JSDOM } from 'jsdom';
import { createMockWebGL2Context } from './mocks/webgl2.js';
import { createMockPointerLock } from '@quake2ts/test-utils';

export function setupBrowserEnvironmentOriginal() {
  // 1. Setup JSDOM for window, document, etc.
  const dom = new JSDOM('<!DOCTYPE html><canvas id="game-canvas"></canvas>', {
    url: 'http://localhost:3000/',
    pretendToBeVisual: true,
    resources: 'usable',
  });

  global.window = dom.window as any;
  global.document = dom.window.document;

  // Handle navigator assignment safely
  try {
    // @ts-ignore
    global.navigator = dom.window.navigator;
  } catch (e) {
    try {
      Object.defineProperty(global, 'navigator', {
        value: dom.window.navigator,
        writable: true,
        configurable: true
      });
    } catch (e2) {
      console.warn('Could not assign global.navigator, skipping.');
    }
  }

  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
  global.Event = dom.window.Event;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.MouseEvent = dom.window.MouseEvent;
  global.WheelEvent = dom.window.WheelEvent;

  // 1b. Mock Pointer Lock API
  createMockPointerLock();

  // 2. Mock requestAnimationFrame
  // We use a simplified version that runs immediately or with small delay for tests,
  // but for strict determinism control we might want to control this manually.
  // For now, we just map it to setTimeout to keep the loop alive if needed.
  let lastTime = 0;
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    const currTime = Date.now();
    const timeToCall = Math.max(0, 16 - (currTime - lastTime));
    const id = setTimeout(() => {
        callback(currTime + timeToCall);
    }, timeToCall);
    lastTime = currTime + timeToCall;
    return id as unknown as number;
  };
}

export function setupBrowserEnvironmentLocal() {
    setupBrowserEnvironmentUtils({
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
