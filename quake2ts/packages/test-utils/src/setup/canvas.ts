import { Canvas, ImageData } from '@napi-rs/canvas';
import { createMockWebGL2Context } from '../engine/mocks/webgl.js';

/**
 * Creates a mock HTMLCanvasElement backed by napi-rs/canvas,
 * with support for both 2D and WebGL2 contexts.
 */
export function createMockCanvas(width: number = 300, height: number = 150): HTMLCanvasElement {
  // Use a real JSDOM canvas if available in the environment (setupBrowserEnvironment)
  if (typeof document !== 'undefined' && document.createElement) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Fallback for non-JSDOM environments or specialized testing
  const napiCanvas = new Canvas(width, height);
  const canvas = {
    width,
    height,
    getContext: (contextId: string, options?: any) => {
      if (contextId === '2d') {
        return napiCanvas.getContext('2d', options);
      }
      if (contextId === 'webgl2') {
         return createMockWebGL2Context(canvas as any);
      }
      return null;
    },
    toDataURL: () => napiCanvas.toDataURL(),
    toBuffer: (mime: any) => napiCanvas.toBuffer(mime),
    // Add other properties as needed
  } as unknown as HTMLCanvasElement;

  return canvas;
}

/**
 * Creates a mock CanvasRenderingContext2D.
 */
export function createMockCanvasContext2D(canvas?: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas || createMockCanvas();
  const ctx = c.getContext('2d');
  if (!ctx) {
      throw new Error('Failed to create 2D context');
  }
  return ctx as CanvasRenderingContext2D;
}

/**
 * Information about a captured draw call.
 */
export interface DrawCall {
  method: string;
  args: any[];
}

/**
 * Wraps a CanvasRenderingContext2D to capture all method calls.
 */
export function captureCanvasDrawCalls(context: CanvasRenderingContext2D): DrawCall[] {
  const calls: DrawCall[] = [];
  const proto = Object.getPrototypeOf(context);

  // Iterate over all properties of the context prototype
  for (const key of Object.getOwnPropertyNames(proto)) {
     const value = (context as any)[key];
     if (typeof value === 'function') {
         // Override function
         (context as any)[key] = function(...args: any[]) {
             calls.push({ method: key, args });
             return value.apply(context, args);
         };
     }
  }

  return calls;
}

/**
 * Creates a mock ImageData object.
 */
export function createMockImageData(width: number, height: number, fillColor?: [number, number, number, number]): ImageData {
  // Check if global ImageData is available (polyfilled by setupBrowserEnvironment)
  if (typeof global.ImageData !== 'undefined') {
      const data = new Uint8ClampedArray(width * height * 4);
      if (fillColor) {
          for (let i = 0; i < data.length; i += 4) {
              data[i] = fillColor[0];
              data[i + 1] = fillColor[1];
              data[i + 2] = fillColor[2];
              data[i + 3] = fillColor[3];
          }
      }
      return new global.ImageData(data, width, height) as unknown as ImageData;
  }

  // Fallback if not globally available, though it should be with @napi-rs/canvas
  const data = new Uint8ClampedArray(width * height * 4);
    if (fillColor) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = fillColor[0];
            data[i + 1] = fillColor[1];
            data[i + 2] = fillColor[2];
            data[i + 3] = fillColor[3];
        }
    }
  return new ImageData(data, width, height);
}

/**
 * Creates a mock HTMLImageElement.
 */
export function createMockImage(width: number = 100, height: number = 100, src: string = ''): HTMLImageElement {
    if (typeof document !== 'undefined' && document.createElement) {
        const img = document.createElement('img');
        img.width = width;
        img.height = height;
        if (src) img.src = src;
        return img;
    }

    // Fallback
    const img = {
        width,
        height,
        src,
        complete: true,
        onload: null,
        onerror: null,
    } as unknown as HTMLImageElement;

    // Simulate async load if src is provided
    if (src) {
        setTimeout(() => {
            if (img.onload) (img.onload as any)();
        }, 0);
    }

    return img;
}
