import { JSDOM } from 'jsdom';
import { Canvas, Image, ImageData } from '@napi-rs/canvas';
import 'fake-indexeddb/auto';
import { MockPointerLock } from '../client/mocks/input.js';
import { createMockWebGL2Context } from './webgl.js';

export interface BrowserSetupOptions {
  url?: string;
  pretendToBeVisual?: boolean;
  resources?: "usable";
  enableWebGL2?: boolean;
  enablePointerLock?: boolean;
}

/**
 * Puts a value on the global object. Under Vitest's jsdom environment some globals
 * (`document`, `navigator`) are getter-only accessors, so a plain assignment throws;
 * redefine those instead.
 */
function setGlobal(name: string, value: unknown): void {
  try {
    (globalThis as any)[name] = value;
    if ((globalThis as any)[name] === value) return;
  } catch {
    // Getter-only accessor: fall through and redefine it.
  }
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
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
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);

  // Polyfill global DOM Constructors
  setGlobal('Document', dom.window.Document);
  setGlobal('Element', dom.window.Element);
  setGlobal('Node', dom.window.Node);

  setGlobal('navigator', dom.window.navigator);

  setGlobal('location', dom.window.location);
  setGlobal('HTMLElement', dom.window.HTMLElement);
  setGlobal('HTMLCanvasElement', dom.window.HTMLCanvasElement);

  // Polyfill global Event constructors
  setGlobal('Event', dom.window.Event);
  setGlobal('CustomEvent', dom.window.CustomEvent);
  setGlobal('DragEvent', dom.window.DragEvent);
  setGlobal('MouseEvent', dom.window.MouseEvent);
  setGlobal('KeyboardEvent', dom.window.KeyboardEvent);
  setGlobal('FocusEvent', dom.window.FocusEvent);
  setGlobal('WheelEvent', dom.window.WheelEvent);
  setGlobal('InputEvent', dom.window.InputEvent);
  setGlobal('UIEvent', dom.window.UIEvent);

  // Setup Storage mocks
  try {
      setGlobal('localStorage', dom.window.localStorage);
  } catch (e) {
      // Ignore if it fails
  }

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

  // Override document.createElement for canvas elements
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function (tagName: string, options?: any) {
    if (tagName.toLowerCase() === 'canvas') {
      const napiCanvas = new Canvas(300, 150);
      const domCanvas = originalCreateElement('canvas', options);

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

      const originalGetContext = domCanvas.getContext.bind(domCanvas);
      domCanvas.getContext = function(contextId: string, options?: any) {
        if (contextId === '2d') {
          return napiCanvas.getContext('2d', options);
        }

        if (enableWebGL2 && contextId === 'webgl2') {
           return createMockWebGL2Context(domCanvas as HTMLCanvasElement);
        }

        if (contextId === 'webgl' || contextId === 'webgl2') {
          return originalGetContext(contextId, options);
        }
        return napiCanvas.getContext(contextId as any, options);
      } as any;

      (domCanvas as any).__napiCanvas = napiCanvas;

      return domCanvas;
    }
    return originalCreateElement(tagName, options);
  } as any;

  if (enableWebGL2) {
      const originalProtoGetContext = global.HTMLCanvasElement.prototype.getContext;
      global.HTMLCanvasElement.prototype.getContext = function (
        contextId: string,
        options?: any
      ): any {
        if (contextId === 'webgl2') {
          return createMockWebGL2Context(this);
        }
        // @ts-ignore
        return originalProtoGetContext.call(this, contextId as any, options);
      };
  }

  setGlobal('Image', Image);
  setGlobal('ImageData', ImageData);

  if (typeof global.createImageBitmap === 'undefined') {
    global.createImageBitmap = async function (
      image: any,
      _options?: ImageBitmapOptions
    ): Promise<any> {
      if (image && typeof image.width === 'number' && typeof image.height === 'number') {
        const canvas = new Canvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        if (image.data) {
           ctx.putImageData(image as any, 0, 0);
        }
        return canvas;
      }
      const canvas = new Canvas(100, 100);
      return canvas;
    } as unknown as any;
  }

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

  if (enablePointerLock) {
      new MockPointerLock(global.document);
  }

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
 * Should be called in afterAll hooks to prevent memory leaks.
 */
export function teardownBrowserEnvironment() {
  // Restore HTMLElement prototype if it was patched by MockPointerLock
  if ((global.HTMLElement?.prototype as any)?.__originalRequestPointerLock) {
    (global.HTMLElement.prototype as any).requestPointerLock =
      (global.HTMLElement.prototype as any).__originalRequestPointerLock;
    delete (global.HTMLElement.prototype as any).__originalRequestPointerLock;
  }

  // Clean up __mockPointerLockInstalled flag from document
  if (global.document && (global.document as any).__mockPointerLockInstalled) {
    delete (global.document as any).__mockPointerLockInstalled;
  }

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

  // Clean up additional globals that may have been set
  // @ts-ignore
  delete global.Document;
  // @ts-ignore
  delete global.Element;
  // @ts-ignore
  delete global.Node;
  // @ts-ignore
  delete global.btoa;
  // @ts-ignore
  delete global.atob;
  // @ts-ignore
  delete global.requestAnimationFrame;
  // @ts-ignore
  delete global.cancelAnimationFrame;
}
