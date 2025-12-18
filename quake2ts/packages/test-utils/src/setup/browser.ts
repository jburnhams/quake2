import { JSDOM } from 'jsdom';
import { Canvas, Image, ImageData } from '@napi-rs/canvas';
import 'fake-indexeddb/auto';

export interface BrowserSetupOptions {
  url?: string;
  pretendToBeVisual?: boolean;
}

/**
 * Sets up a browser environment for testing using JSDOM and napi-rs/canvas.
 * This should be called in your vitest.setup.ts file.
 */
export function setupBrowserEnvironment(options: BrowserSetupOptions = {}) {
  const { url = 'http://localhost', pretendToBeVisual = true } = options;

  // Create a JSDOM instance
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url,
    pretendToBeVisual,
  });

  // Set up global variables
  global.window = dom.window as any;
  global.document = dom.window.document;
  global.navigator = dom.window.navigator;
  global.location = dom.window.location;
  global.HTMLElement = dom.window.HTMLElement;

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
    } as any;
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
  delete global.Image;
  // @ts-ignore
  delete global.ImageData;
  // @ts-ignore
  delete global.createImageBitmap;

  // Note: btoa/atob might be native in newer Node versions, so be careful deleting them if they were original.
  // But here we only set them if undefined.
}
