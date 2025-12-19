import { Canvas, Image, ImageData } from '@napi-rs/canvas';
import { createMockWebGL2Context } from './webgl.js';

export interface DrawCall {
  method: string;
  args: any[];
}

/**
 * Creates a mock canvas element with WebGL2 support.
 */
export function createMockCanvas(width: number = 300, height: number = 150): HTMLCanvasElement {
    // If we are in JSDOM environment, use document.createElement
    if (typeof document !== 'undefined' && document.createElement) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // Otherwise use napi-rs/canvas directly
    const canvas = new Canvas(width, height);

    // Patch getContext to return mock WebGL2 context
    const originalGetContext = canvas.getContext.bind(canvas);
    canvas.getContext = function(contextId: string, options?: any) {
        if (contextId === 'webgl2') {
            return createMockWebGL2Context(canvas as unknown as HTMLCanvasElement);
        }
        if (contextId === '2d') {
             return originalGetContext('2d', options);
        }
        return originalGetContext(contextId as any, options);
    } as any;

    return canvas as unknown as HTMLCanvasElement;
}

/**
 * Creates a mock 2D rendering context.
 */
export function createMockCanvasContext2D(canvas?: HTMLCanvasElement): CanvasRenderingContext2D {
    if (!canvas) {
        canvas = createMockCanvas();
    }
    return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}

/**
 * Spies on draw operations for verification.
 * Note: This modifies the context prototype or instance methods.
 */
export function captureCanvasDrawCalls(context: CanvasRenderingContext2D): DrawCall[] {
    const drawCalls: DrawCall[] = [];
    const methodsToSpy = [
        'fillRect', 'strokeRect', 'clearRect',
        'fillText', 'strokeText',
        'drawImage',
        'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'arcTo', 'bezierCurveTo', 'quadraticCurveTo',
        'stroke', 'fill',
        'putImageData'
    ];

    methodsToSpy.forEach(method => {
        // @ts-ignore
        const original = context[method];
        if (typeof original === 'function') {
             // @ts-ignore
             context[method] = function(...args: any[]) {
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
export function createMockImageData(width: number, height: number, fillColor?: [number, number, number, number]): ImageData {
    const imageData = new ImageData(width, height);
    if (fillColor) {
        const [r, g, b, a] = fillColor;
        for (let i = 0; i < imageData.data.length; i += 4) {
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
            imageData.data[i + 3] = a;
        }
    }
    return imageData;
}

/**
 * Creates a mock Image element.
 */
export function createMockImage(width?: number, height?: number, src?: string): HTMLImageElement {
    const img = new Image();
    if (width) img.width = width;
    if (height) img.height = height;
    if (src) img.src = src;
    return img as unknown as HTMLImageElement;
}
