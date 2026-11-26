import { createHeadlessWebGL, captureWebGLFramebuffer, HeadlessWebGLContext } from '../../setup/headless-webgl.js';
// Removed invalid import

export interface WebGLRenderTestSetup {
  gl: WebGL2RenderingContext;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Creates a setup for testing WebGL rendering.
 * Initializes a headless WebGL context.
 */
export async function createWebGLRenderTestSetup(
  width: number = 256,
  height: number = 256
): Promise<WebGLRenderTestSetup> {
  const context = createHeadlessWebGL({ width, height });

  return {
    gl: context.gl,
    width: context.width,
    height: context.height,
    cleanup: context.cleanup
  };
}

/**
 * Helper to render and capture the output as pixel data.
 * Executes the render function, ensures completion, and captures the framebuffer.
 */
export async function renderAndCaptureWebGL(
  setup: WebGLRenderTestSetup,
  renderFn: (gl: WebGL2RenderingContext) => void
): Promise<Uint8ClampedArray> {
  const { gl, width, height } = setup;

  // Execute the user's render function
  renderFn(gl);

  // Ensure all commands are finished before reading pixels
  gl.finish();

  // Capture the framebuffer content
  return captureWebGLFramebuffer(gl, width, height);
}
