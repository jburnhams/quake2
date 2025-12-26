import { createHeadlessWebGL, HeadlessWebGLContext, captureWebGLFramebuffer } from '../../setup/headless-webgl.js';

export interface WebGLRenderTestSetup extends HeadlessWebGLContext {
  // Add any test-specific state here if needed
}

/**
 * Creates a setup for testing WebGL rendering.
 * Wraps createHeadlessWebGL for consistency with other test helpers.
 */
export async function createWebGLRenderTestSetup(
  width: number = 256,
  height: number = 256
): Promise<WebGLRenderTestSetup> {
  // createHeadlessWebGL is synchronous but we keep Promise signature for consistency with WebGPU
  const context = createHeadlessWebGL({ width, height });
  return context;
}

/**
 * Helper to render using the callback and capture the framebuffer.
 */
export async function renderAndCaptureWebGL(
  setup: WebGLRenderTestSetup,
  renderFn: (gl: WebGL2RenderingContext) => void
): Promise<Uint8ClampedArray> {
  const { gl, width, height } = setup;

  // Render
  renderFn(gl);

  // Ensure commands are finished
  gl.finish();

  // Capture
  return captureWebGLFramebuffer(gl, width, height);
}
