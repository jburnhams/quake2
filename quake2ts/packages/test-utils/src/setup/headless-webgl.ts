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
 * Note: 'gl' is lazy-loaded to avoid issues in environments where it's not supported/needed.
 */
export async function createHeadlessWebGL(
  options: HeadlessWebGLOptions = {}
): Promise<HeadlessWebGLContext> {
  const width = options.width ?? 256;
  const height = options.height ?? 256;

  // Dynamically import gl
  // @ts-ignore - gl package might not be typed correctly for dynamic import or TS config
  const { default: gl } = await import('gl');

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

  // Cast to WebGL2RenderingContext
  const glContext = context as unknown as WebGL2RenderingContext;

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
 * Flips pixel data vertically in-place.
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
