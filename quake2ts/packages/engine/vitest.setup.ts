/**
 * Vitest setup file for engine package tests
 *
 * Sets up jsdom with napi-rs/canvas support for Node.js testing
 */

import { vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Canvas, Image, ImageData } from '@napi-rs/canvas';

// Create a JSDOM instance
const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

// Set up global variables
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

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

    // Override getContext to return napi-rs canvas context
    const originalGetContext = domCanvas.getContext.bind(domCanvas);
    domCanvas.getContext = function(contextId: string, options?: any) {
      if (contextId === '2d') {
        return napiCanvas.getContext('2d', options);
      }
      // For webgl/webgl2, return a mock since napi-rs doesn't support it
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
    imageData: ImageData,
    options?: ImageBitmapOptions
  ): Promise<any> {
    // For testing purposes, we can create a small canvas with the image data
    const canvas = new Canvas(imageData.width, imageData.height);
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };
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
