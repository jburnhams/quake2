import { Canvas, ImageData } from '@napi-rs/canvas';

/**
 * Creates a mock canvas element backed by napi-rs/canvas.
 */
export function createMockCanvas(width: number = 300, height: number = 150): HTMLCanvasElement {
  const canvas = new Canvas(width, height);
  // We need to cast this because napi-rs/canvas doesn't perfectly match HTMLCanvasElement
  return canvas as unknown as HTMLCanvasElement;
}

/**
 * Creates a mock 2D context.
 */
export function createMockCanvasContext2D(canvas?: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas || createMockCanvas();
  return c.getContext('2d') as unknown as CanvasRenderingContext2D;
}

export interface DrawCall {
  method: string;
  args: any[];
}

/**
 * Wraps a canvas context to capture all draw calls.
 */
export function captureCanvasDrawCalls(context: CanvasRenderingContext2D): DrawCall[] {
  const drawCalls: DrawCall[] = [];
  const proxy = new Proxy(context, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original === 'function') {
        return (...args: any[]) => {
          drawCalls.push({ method: String(prop), args });
          return original.apply(this, args);
        };
      }
      return original;
    }
  });
  return drawCalls;
}

// Better implementation of capture:
// returns { context: Proxy, calls: DrawCall[] }
export function createCapturingContext(context?: CanvasRenderingContext2D) {
  const ctx = context || createMockCanvasContext2D();
  const calls: DrawCall[] = [];
  const proxy = new Proxy(ctx, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);
      if (typeof original === 'function') {
         // Check if it's a drawing method? For now capture all functions.
        return (...args: any[]) => {
          calls.push({ method: String(prop), args });
          return original.apply(target, args);
        };
      }
      return original;
    }
  });
  return { context: proxy, calls };
}

/**
 * Creates a mock ImageData object.
 */
export function createMockImageData(width: number, height: number, fillColor?: [number, number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  if (fillColor) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = fillColor[0];
      data[i + 1] = fillColor[1];
      data[i + 2] = fillColor[2];
      data[i + 3] = fillColor[3];
    }
  }
  return new ImageData(data, width, height) as unknown as ImageData;
}

/**
 * Creates a mock Image element.
 */
export function createMockImage(width?: number, height?: number, src?: string): HTMLImageElement {
    // In JSDOM/napi-rs environment, Image is globally available or polyfilled
    const img = new Image();
    if (width) img.width = width;
    if (height) img.height = height;
    if (src) img.src = src;
    return img as unknown as HTMLImageElement;
}
