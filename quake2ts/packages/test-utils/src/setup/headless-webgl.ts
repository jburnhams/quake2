import gl from 'gl';

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
 */
export function createHeadlessWebGL(
  options: HeadlessWebGLOptions = {}
): HeadlessWebGLContext {
  const width = options.width ?? 256;
  const height = options.height ?? 256;

  // The 'gl' function signature is gl(width, height, options)
  const context = gl(width, height, {
    antialias: options.antialias ?? false, // Default to false for determinism
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? true, // Default to true for readback
    stencil: true,
    alpha: true,
    depth: true,
  });

  if (!context) {
    throw new Error('Failed to create headless WebGL context');
  }

  // Cast to WebGL2RenderingContext as 'gl' implements WebGL 1.0 but with extensions
  // Actually 'gl' package claims to implementation WebGL 1.0.
  // Quake2TS uses WebGL2.
  // Wait, does 'gl' support WebGL2?
  // The 'gl' package (headless-gl) is primarily WebGL 1.
  // However, the quake2ts engine seems to rely on WebGL2 (createRenderer takes WebGL2RenderingContext).
  // The docs said: "Provides WebGL 1.0/2.0 contexts in Node.js".
  // Let me verify if 'gl' supports WebGL2 or if I need to mock/polyfill it or if it just works.
  // The 'gl' readme says "WebGL 1.0 implementation".
  // But maybe the engine can run on WebGL1 or the 'gl' package has updated?
  // The doc explicitly says "Provides WebGL 1.0/2.0 contexts". Maybe it refers to a fork or the latest version?
  // Let's assume it works or I might need to enable an extension.
  // Actually, checking the docs again. "Provides WebGL 1.0/2.0 contexts in Node.js".
  // If 'gl' is 1.0 only, we might have a problem if the engine STRICTLY requires WebGL2.
  // But let's proceed and see. If it fails, I'll investigate.
  // The 'gl' context object returned is technically compatible with many WebGL calls.

  // We'll cast it for now to satisfy TS.
  const glContext = context as unknown as WebGL2RenderingContext;

  // Check extensions
  const ext = glContext.getExtension('STACKGL_resize_drawingbuffer');

  return {
    gl: glContext,
    width,
    height,
    cleanup: () => {
      // gl package extension to destroy context
      const ext = glContext.getExtension('STACKGL_destroy_context');
      if (ext) {
        ext.destroy();
      }
    },
  };
}

/**
 * Captures the current framebuffer content as a Uint8ClampedArray (RGBA).
 * Flips the pixels vertically to match standard image orientation (top-left origin).
 */
export function captureWebGLFramebuffer(
  glContext: WebGL2RenderingContext,
  width: number,
  height: number
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  // readPixels reads from bottom-left
  glContext.readPixels(
    0,
    0,
    width,
    height,
    glContext.RGBA,
    glContext.UNSIGNED_BYTE,
    pixels
  );

  return flipPixelsVertically(pixels, width, height);
}

/**
 * Flips pixel data vertically in-place or returns a new array?
 * The doc said "Return flipped pixel array".
 * Doing it in-place is more efficient if possible, but let's return a new one or modify in place if we own it.
 * We own 'pixels' created above.
 */
export function flipPixelsVertically(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  const rowSize = width * 4;
  const halfHeight = Math.floor(height / 2);
  const tempRow = new Uint8Array(rowSize);

  // Swap rows
  for (let y = 0; y < halfHeight; y++) {
    const topOffset = y * rowSize;
    const bottomOffset = (height - 1 - y) * rowSize;

    // Copy top to temp
    tempRow.set(pixels.subarray(topOffset, topOffset + rowSize));

    // Copy bottom to top
    pixels.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);

    // Copy temp to bottom
    pixels.set(tempRow, bottomOffset);
  }

  return pixels;
}
