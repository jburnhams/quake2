import { describe, test, expect, beforeAll } from 'vitest';
import { createHeadlessWebGL, captureWebGLFramebuffer } from '../../src/setup/headless-webgl';

describe('Headless WebGL', () => {
  let supported = false;

  beforeAll(() => {
    try {
      // Attempt to create a small context to check environment support
      const ctx = createHeadlessWebGL({ width: 16, height: 16 });
      ctx.cleanup();
      supported = true;
    } catch (e) {
      console.warn('Headless WebGL environment check failed. Tests requiring "gl" will be skipped.', e);
    }
  });

  test('creates headless WebGL context', () => {
    if (!supported) {
      console.log('Skipping test: WebGL not supported');
      return;
    }

    const { gl, width, height, cleanup } = createHeadlessWebGL();

    expect(gl).toBeDefined();
    expect(width).toBe(256);
    expect(height).toBe(256);

    // Verify some basic GL functionality works
    expect(gl.getParameter(gl.VIEWPORT)).toEqual(new Int32Array([0, 0, 256, 256]));

    cleanup();
  });

  test('creates context with custom options', () => {
    if (!supported) return;

    const { gl, width, height, cleanup } = createHeadlessWebGL({
      width: 64,
      height: 32
    });

    expect(width).toBe(64);
    expect(height).toBe(32);
    // headless-gl might not strictly adhere to drawingBufferWidth/Height matching requested if incompatible,
    // but usually it does.
    expect(gl.drawingBufferWidth).toBe(64);
    expect(gl.drawingBufferHeight).toBe(32);

    cleanup();
  });

  test('captures framebuffer pixels', () => {
    if (!supported) return;

    const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 64, height: 64 });

    // Clear to red
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pixels = captureWebGLFramebuffer(gl, width, height);

    // Verify first pixel is red
    expect(pixels[0]).toBe(255);  // R
    expect(pixels[1]).toBe(0);    // G
    expect(pixels[2]).toBe(0);    // B
    expect(pixels[3]).toBe(255);  // A

    // Verify middle pixel is red
    const midIndex = (32 * 64 + 32) * 4;
    expect(pixels[midIndex]).toBe(255);
    expect(pixels[midIndex + 1]).toBe(0);
    expect(pixels[midIndex + 2]).toBe(0);
    expect(pixels[midIndex + 3]).toBe(255);

    cleanup();
  });

  test('vertical flip works correctly', () => {
    if (!supported) return;

    const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 2, height: 2 });

    // Scissor to fill top half green, bottom half blue
    // In WebGL coordinates (bottom-up):
    // y=0 is bottom, y=1 is top

    // Clear all to black first
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.enable(gl.SCISSOR_TEST);

    // Bottom row (y=0) -> Blue
    gl.scissor(0, 0, 2, 1);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Top row (y=1) -> Green
    gl.scissor(0, 1, 2, 1);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Readback should return top-down
    // So first pixels (index 0..3, 4..7) should be Green (Top)
    // Last pixels should be Blue (Bottom)
    const pixels = captureWebGLFramebuffer(gl, width, height);

    // Top-Left (Row 0, Col 0) -> Green
    expect(pixels[0]).toBe(0);
    expect(pixels[1]).toBe(255);
    expect(pixels[2]).toBe(0);
    expect(pixels[3]).toBe(255);

    // Bottom-Left (Row 1, Col 0) -> Blue
    // Index = (1 * 2 + 0) * 4 = 8
    expect(pixels[8]).toBe(0);
    expect(pixels[9]).toBe(0);
    expect(pixels[10]).toBe(255);
    expect(pixels[11]).toBe(255);

    cleanup();
  });
});
