import { Canvas, ImageData } from '@napi-rs/canvas';
import { createMockWebGL2Context } from '../engine/mocks/webgl.js';

/**
 * Creates a mock canvas element capable of returning 2D or WebGL2 contexts.
 * Uses napi-rs/canvas for 2D and our mock WebGL2 context for 3D.
 */
export function createMockCanvas(width: number = 300, height: number = 150): HTMLCanvasElement {
  // Use napi-rs canvas as the base
  const napiCanvas = new Canvas(width, height);

  // Create a partial mock that mimics HTMLCanvasElement
  // We use type casting because we can't fully construct a real HTMLCanvasElement
  // without JSDOM or browser environment, but this helper is often used
  // in environments where JSDOM might already be active or we just need the object shape.

  // If we are in JSDOM, document.createElement('canvas') is better,
  // but if we want a pure mock:

  const mockCanvas = {
    width,
    height,
    getContext: (contextId: string, options?: any) => {
      if (contextId === '2d') {
        return napiCanvas.getContext('2d', options);
      }
      if (contextId === 'webgl2') {
        return createMockWebGL2Context(mockCanvas as HTMLCanvasElement);
      }
      return null;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    getBoundingClientRect: () => ({ x: 0, y: 0, width, height, top: 0, left: 0, right: width, bottom: height }),
    style: {},
    toDataURL: () => napiCanvas.toDataURL(),
    toBuffer: (mime?: string) => napiCanvas.toBuffer(mime as any),
  } as unknown as HTMLCanvasElement;

  return mockCanvas;
}

/**
 * Creates a mock 2D rendering context.
 */
export function createMockCanvasContext2D(width: number = 300, height: number = 150): CanvasRenderingContext2D {
  const canvas = new Canvas(width, height);
  return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}

export interface DrawCall {
  method: string;
  args: any[];
}

/**
 * Wraps a CanvasRenderingContext2D to capture all draw calls.
 */
export function captureCanvasDrawCalls(context: CanvasRenderingContext2D): DrawCall[] {
  const drawCalls: DrawCall[] = [];

  // List of drawing methods to spy on
  const methods = [
    'fillRect', 'strokeRect', 'clearRect',
    'fillText', 'strokeText',
    'beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo',
    'arc', 'arcTo', 'rect',
    'fill', 'stroke',
    'drawImage',
    'putImageData',
    'save', 'restore',
    'scale', 'rotate', 'translate', 'transform', 'setTransform'
  ];

  methods.forEach(method => {
    const original = (context as any)[method];
    if (typeof original === 'function') {
      (context as any)[method] = function(...args: any[]) {
        drawCalls.push({ method, args });
        return original.apply(this, args);
      };
    }
  });

  return drawCalls;
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
  return new ImageData(data, width, height) as unknown as ImageData;
}

/**
 * Creates a mock Image element with optional source.
 */
export function createMockImage(width: number = 100, height: number = 100, src?: string): HTMLImageElement {
  // If JSDOM is present, use it
  if (typeof document !== 'undefined' && document.createElement) {
    const img = document.createElement('img');
    img.width = width;
    img.height = height;
    if (src) img.src = src;
    return img;
  }

  // Otherwise simple mock
  return {
    width,
    height,
    src: src || '',
    onload: null,
    onerror: null,
    complete: true,
    addEventListener: () => {},
    removeEventListener: () => {}
  } as unknown as HTMLImageElement;
}
