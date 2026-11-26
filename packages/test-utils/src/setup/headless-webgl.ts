// Remove top-level import to avoid runtime crash when gl is missing
// import createGL from 'gl';
import type { WebGLContextState } from '@quake2ts/engine';
import { createRequire } from 'module';

export interface HeadlessWebGLOptions {
  width?: number;
  height?: number;
  antialias?: boolean;
  preserveDrawingBuffer?: boolean;
}

export interface HeadlessWebGLContext {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Creates a headless WebGL2 context using the 'gl' package.
 * This is used for running WebGL tests in a Node.js environment without a browser.
 */
export function createHeadlessWebGL(
  options: HeadlessWebGLOptions = {}
): HeadlessWebGLContext {
  const width = options.width ?? 256;
  const height = options.height ?? 256;

  let createGL;
  try {
    const require = createRequire(import.meta.url);
    createGL = require('gl');
  } catch (e) {
    throw new Error('gl package not found or failed to load. Install it to run WebGL tests. Error: ' + e);
  }

  // Create WebGL context using 'gl' package
  const glContext = createGL(width, height, {
    antialias: options.antialias ?? false, // Default to false for deterministic testing
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? true, // Needed for readback
    stencil: true,
    depth: true,
    alpha: true,
    webgl2: true // Request WebGL 2.0 context for GLSL 3.00 ES support
  });

  if (!glContext) {
    throw new Error('Failed to create headless WebGL context');
  }

  // Cast to WebGL2RenderingContext as 'gl' returns a compatible interface
  // but TypeScript types might not align perfectly without casting
  const gl = glContext as unknown as WebGL2RenderingContext;

  // Verify context creation
  const version = gl.getParameter(gl.VERSION);
  // console.log(`Created headless WebGL context: ${version}`);

  // Create cleanup function
  const cleanup = () => {
    const ext = gl.getExtension('STACKGL_destroy_context');
    if (ext) {
      ext.destroy();
    }
  };

  return {
    gl,
    width,
    height,
    cleanup
  };
}

/**
 * Captures the current framebuffer content as a pixel array.
 * Performs a vertical flip to match standard image coordinates (top-left origin).
 */
export function captureWebGLFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  // Read pixels from framebuffer (bottom-left origin)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Flip vertically to match image coordinates (top-left origin)
  return flipPixelsVertically(pixels, width, height);
}

/**
 * Flips a pixel array vertically in-place or returns a new array.
 * WebGL reads pixels bottom-up, but images are typically stored top-down.
 */
export function flipPixelsVertically(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const flipped = new Uint8ClampedArray(pixels.length);
  const rowSize = width * 4;

  for (let y = 0; y < height; y++) {
    const srcRowStart = y * rowSize;
    const destRowStart = (height - 1 - y) * rowSize;

    // Copy row
    for (let i = 0; i < rowSize; i++) {
      flipped[destRowStart + i] = pixels[srcRowStart + i];
    }
  }

  return flipped;
}
