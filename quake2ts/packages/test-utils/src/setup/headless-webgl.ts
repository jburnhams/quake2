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

// Use createRequire to load 'gl' dynamically/safely if needed, or just to handle the CommonJS nature better.
// We also wrap the require in a try-catch or just checking existence if we were worried about load-time failure,
// but usually 'gl' loads fine and fails at runtime.
const require = createRequire(import.meta.url);

let headlessGL: any;
try {
  headlessGL = require('gl');
} catch (e) {
  // If 'gl' is not installed or fails to load bindings, we leave it undefined.
  // The createHeadlessWebGL function will handle this.
  console.warn('Failed to load "gl" package. Headless WebGL creation will fail.', e);
}

export function createHeadlessWebGL(
  options: HeadlessWebGLOptions = {}
): HeadlessWebGLContext {
  if (!headlessGL) {
    throw new Error('Headless GL package is not available or failed to load.');
  }

  const width = options.width ?? 256;
  const height = options.height ?? 256;

  // Ensure antialias is false for deterministic testing unless explicitly enabled
  const antialias = options.antialias ?? false;
  // Ensure preserveDrawingBuffer is true for readback unless explicitly disabled
  const preserveDrawingBuffer = options.preserveDrawingBuffer ?? true;

  // Create context using 'gl' package
  const context = headlessGL(width, height, {
    antialias,
    preserveDrawingBuffer,
    stencil: true,
    depth: true,
    alpha: true
  });

  if (!context) {
    throw new Error('Failed to create headless WebGL context');
  }

  // Cast to WebGL2RenderingContext
  // Note: The 'gl' package implements WebGL 1, but we cast to WebGL 2 for type compatibility.
  // Engine code should gracefuly handle missing WebGL 2 features or this environment is for specific subsets.
  const gl2 = context as unknown as WebGL2RenderingContext;

  return {
    gl: gl2,
    width,
    height,
    cleanup: () => {
      const ext = context.getExtension('STACKGL_destroy_context');
      if (ext && typeof ext.destroy === 'function') {
        ext.destroy();
      }
    }
  };
}

export function flipPixelsVertically(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const flipped = new Uint8ClampedArray(pixels.length);
  const rowSize = width * 4;

  for (let y = 0; y < height; y++) {
    const srcRowStart = y * rowSize;
    const dstRowStart = (height - 1 - y) * rowSize;
    // Copy row
    flipped.set(pixels.subarray(srcRowStart, srcRowStart + rowSize), dstRowStart);
  }

  return flipped;
}

export function captureWebGLFramebuffer(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  // Read pixels (returns bottom-up)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  // Flip to top-down
  return flipPixelsVertically(pixels, width, height);
}
