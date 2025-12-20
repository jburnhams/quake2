import { Canvas, ImageData } from '@napi-rs/canvas';
import { createMockWebGL2Context } from './webgl.js';

/**
 * Creates a mock canvas element backed by napi-rs/canvas for testing.
 * Includes support for WebGL2 context mocking.
 */
export function createMockCanvas(width: number = 300, height: number = 150): HTMLCanvasElement {
  // Use napi-rs/canvas for 2D support
  const napiCanvas = new Canvas(width, height);

  // Create a proxy/mock that behaves like HTMLCanvasElement
  const canvas = {
    width,
    height,
    style: {},
    getContext: (contextId: string, options?: any) => {
      if (contextId === '2d') {
        return napiCanvas.getContext('2d', options) as any;
      }
      if (contextId === 'webgl2' || contextId === 'webgl') {
        return createMockWebGL2Context(canvas as unknown as HTMLCanvasElement);
      }
      return null;
    },
    toDataURL: (mime?: any, quality?: any) => napiCanvas.toDataURL(mime, quality),
    toBuffer: (mime?: any, config?: any) => napiCanvas.toBuffer(mime, config),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    getBoundingClientRect: () => ({
        width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => {}
    }),
  } as unknown as HTMLCanvasElement;

  return canvas;
}

/**
 * Creates a mock 2D rendering context.
 */
export function createMockCanvasContext2D(canvas?: HTMLCanvasElement): CanvasRenderingContext2D {
  if (!canvas) {
      canvas = createMockCanvas();
  }
  return canvas.getContext('2d') as CanvasRenderingContext2D;
}

export interface DrawCall {
    method: string;
    args: any[];
}

/**
 * Wraps a CanvasRenderingContext2D to capture all method calls.
 * Useful for verifying drawing operations.
 */
export function captureCanvasDrawCalls(context: CanvasRenderingContext2D): { context: CanvasRenderingContext2D, drawCalls: DrawCall[] } {
    const drawCalls: DrawCall[] = [];

    const handler = {
        get(target: any, prop: string | symbol) {
            const value = target[prop];
            if (typeof value === 'function') {
                return (...args: any[]) => {
                    drawCalls.push({ method: String(prop), args });
                    return value.apply(target, args);
                };
            }
            return value;
        }
    };

    const proxy = new Proxy(context, handler);
    return { context: proxy, drawCalls };
}

/**
 * Creates a mock ImageData object.
 */
export function createMockImageData(width: number, height: number, fillColor: [number, number, number, number] = [0, 0, 0, 0]): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = fillColor[0];
        data[i+1] = fillColor[1];
        data[i+2] = fillColor[2];
        data[i+3] = fillColor[3];
    }
    // napi-rs ImageData
    return new ImageData(data, width, height);
}

/**
 * Creates a mock Image element.
 */
export function createMockImage(width: number = 100, height: number = 100, src: string = ''): HTMLImageElement {
    // If we are in a JSDOM environment, use the global Image
    if (typeof global.Image !== 'undefined') {
        const img = new global.Image(width, height);
        if (src) img.src = src;
        return img as HTMLImageElement;
    }

    // Otherwise create a simple mock
    return {
        width,
        height,
        src,
        onload: null,
        onerror: null,
        complete: true,
        naturalWidth: width,
        naturalHeight: height,
        addEventListener: () => {},
        removeEventListener: () => {},
    } as unknown as HTMLImageElement;
}
