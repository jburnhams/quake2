import { JSDOM } from 'jsdom';
import { Canvas, Image, ImageData } from '@napi-rs/canvas';
import 'fake-indexeddb/auto';
import { MockPointerLock } from '../e2e/input.js';
import { createMockWebGL2Context } from './webgl.js';

export interface BrowserSetupOptions {
  url?: string;
  pretendToBeVisual?: boolean;
  resources?: "usable";
  enableWebGL2?: boolean;
  enablePointerLock?: boolean;
}

/**
 * Sets up a browser environment for testing using JSDOM and napi-rs/canvas.
 * This should be called in your vitest.setup.ts file.
 */
export function setupBrowserEnvironment(options: BrowserSetupOptions = {}) {
  const {
    url = 'http://localhost',
    pretendToBeVisual = true,
    resources = undefined,
    enableWebGL2 = false,
    enablePointerLock = false
  } = options;

  // Create a JSDOM instance
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url,
    pretendToBeVisual,
    resources: resources as any
  });

  // Set up global variables
  global.window = dom.window as any;
  global.document = dom.window.document;

  // Handle navigator assignment safely (handling read-only global.navigator if needed)
  try {
    // @ts-ignore
    global.navigator = dom.window.navigator;
  } catch (e) {
    // If direct assignment fails, try Object.defineProperty
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

  global.location = dom.window.location;
  global.HTMLElement = dom.window.HTMLElement;
  global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

  // Polyfill global Event constructors to match JSDOM's window
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
  global.DragEvent = dom.window.DragEvent as any;
  global.MouseEvent = dom.window.MouseEvent;
  global.KeyboardEvent = dom.window.KeyboardEvent;
  global.FocusEvent = dom.window.FocusEvent;
  global.WheelEvent = dom.window.WheelEvent;
  global.InputEvent = dom.window.InputEvent;
  global.UIEvent = dom.window.UIEvent;

  // Setup Storage mocks
  // First try to use JSDOM's localStorage
  try {
      global.localStorage = dom.window.localStorage;
  } catch (e) {
      // Ignore if it fails (e.g. strict mode)
  }

  // Fallback if not present
  if (!global.localStorage) {
    const storage = new Map<string, string>();
    global.localStorage = {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] || null,
      get length() { return storage.size; }
    } as Storage;
  }

  // Override document.createElement for canvas elements to use napi-rs/canvas
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName: string, options?: any) {
    if (tagName.toLowerCase() === 'canvas') {
      const napiCanvas = new Canvas(300, 150); // default canvas size

      // Create a wrapper that extends the DOM canvas element
      const domCanvas = originalCreateElement('canvas', options);

      // Copy properties and methods from napi-rs canvas to DOM canvas
      Object.defineProperty(domCanvas, 'width', {
        get: () => napiCanvas.width,
        set: (value) => { napiCanvas.width = value; },
        enumerable: true,
        configurable: true
      });

      Object.defineProperty(domCanvas, 'height', {
        get: () => napiCanvas.height,
        set: (value) => { napiCanvas.height = value; },
        enumerable: true,
        configurable: true
      });

      // Override getContext to return appropriate context
      const originalGetContext = domCanvas.getContext.bind(domCanvas);
      domCanvas.getContext = function(contextId: string, options?: any) {
        if (contextId === '2d') {
          return napiCanvas.getContext('2d', options);
        }

        if (enableWebGL2 && contextId === 'webgl2') {
           return createMockWebGL2Context(domCanvas as HTMLCanvasElement);
        }

        // For webgl/webgl2, return jsdom's default context (null or mock)
        // or the original behavior if needed.
        if (contextId === 'webgl' || contextId === 'webgl2') {
          return originalGetContext(contextId, options);
        }
        return napiCanvas.getContext(contextId as any, options);
      } as any;

      // Store reference to napi canvas for direct access if needed
      (domCanvas as any).__napiCanvas = napiCanvas;

      return domCanvas;
    }
    return originalCreateElement(tagName, options);
  } as any;

  // Also override HTMLCanvasElement.prototype.getContext to support direct instantiation via JSDOM
  if (enableWebGL2) {
      const originalProtoGetContext = global.HTMLCanvasElement.prototype.getContext;
      global.HTMLCanvasElement.prototype.getContext = function (
        contextId: string,
        options?: any
      ): any {
        if (contextId === 'webgl2') {
          return createMockWebGL2Context(this);
        }
        // jsdom's getContext doesn't officially support options in types in some versions,
        // or we are calling it with 3 arguments (this, contextId, options) via call?
        // Actually originalProtoGetContext.call(this, contextId, options) is passing 3 args to call:
        // this arg, arg1, arg2. If jsdom definition has 1 arg, it might complain.
        // @ts-ignore - JSDOM definitions might not support the options argument yet, but we need to pass it
        return originalProtoGetContext.call(this, contextId as any, options);
      };
  }

  // Set up global Image constructor
  global.Image = Image as any;

  // Set up global ImageData constructor
  global.ImageData = ImageData as any;

  // Mock createImageBitmap if not available
  if (typeof global.createImageBitmap === 'undefined') {
    global.createImageBitmap = async function (
      image: any, // Relax type to allow passing different image sources
      _options?: ImageBitmapOptions
    ): Promise<any> {
      // Handle ImageData specially
      if (image && typeof image.width === 'number' && typeof image.height === 'number') {
        // For testing purposes, we can create a small canvas with the image data
        const canvas = new Canvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        // Only try to put data if it looks like ImageData
        if (image.data) {
           ctx.putImageData(image as any, 0, 0);
        }
        return canvas;
      }
      // Fallback for other sources (e.g. Image element) - return empty canvas of generic size
      const canvas = new Canvas(100, 100);
      return canvas;
    } as unknown as any;
  }

  // Mock btoa and atob if not available
  if (typeof global.btoa === 'undefined') {
    global.btoa = function (str: string): string {
      return Buffer.from(str, 'binary').toString('base64');
    };
  }

  if (typeof global.atob === 'undefined') {
    global.atob = function (str: string): string {
      return Buffer.from(str, 'base64').toString('binary');
    };
  }

  // Mock Pointer Lock API
  if (enablePointerLock) {
      MockPointerLock.setup(global.document);
  }

  // Mock requestAnimationFrame
  // We use a simplified version that runs immediately or with small delay for tests
  if (typeof global.requestAnimationFrame === 'undefined') {
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

      global.cancelAnimationFrame = (id: number) => {
        clearTimeout(id);
      };
  }
}

/**
 * Cleans up the browser environment.
 */
export function teardownBrowserEnvironment() {
  // Optional cleanup if needed, though usually global scope cleanup is handled by test runner context
  // or by just overriding it again.
  // For strict cleanup, we could delete globals, but in Vitest environment, it might persist?
  // We'll leave it simple for now or just undefined them.

  // @ts-ignore
  delete global.window;
  // @ts-ignore
  delete global.document;
  // @ts-ignore
  delete global.navigator;
  // @ts-ignore
  delete global.localStorage;
  // @ts-ignore
  delete global.location;
  // @ts-ignore
  delete global.HTMLElement;
  // @ts-ignore
  delete global.HTMLCanvasElement;
  // @ts-ignore
  delete global.Image;
  // @ts-ignore
  delete global.ImageData;
  // @ts-ignore
  delete global.createImageBitmap;

  // @ts-ignore
  delete global.Event;
  // @ts-ignore
  delete global.CustomEvent;
  // @ts-ignore
  delete global.DragEvent;
  // @ts-ignore
  delete global.MouseEvent;
  // @ts-ignore
  delete global.KeyboardEvent;
  // @ts-ignore
  delete global.FocusEvent;
  // @ts-ignore
  delete global.WheelEvent;
  // @ts-ignore
  delete global.InputEvent;
  // @ts-ignore
  delete global.UIEvent;

  // Note: btoa/atob might be native in newer Node versions, so be careful deleting them if they were original.
  // But here we only set them if undefined.
}
