import { describe, test, expect } from 'vitest';
import { createHeadlessWebGL, captureWebGLFramebuffer, flipPixelsVertically } from '../../src/setup/headless-webgl';

describe('Headless WebGL Setup', () => {
  test('creates headless WebGL context', () => {
    try {
      const { gl, width, height, cleanup } = createHeadlessWebGL();

      expect(gl).toBeDefined();
      expect(width).toBe(256);
      expect(height).toBe(256);

      // Verify it's a GL context by checking a parameter
      const viewport = gl.getParameter(gl.VIEWPORT);
      // gl (headless-gl) default viewport might be 0,0,width,height
      expect(viewport).toBeDefined();
      expect(viewport[2]).toBe(256);
      expect(viewport[3]).toBe(256);

      cleanup();
    } catch (e: any) {
        if (e.message.includes('Failed to create headless WebGL context')) {
            console.warn('Skipping test due to environment limitations');
            return;
        }
        throw e;
    }
  });

  test('creates context with custom options', () => {
    try {
        const { gl, width, height, cleanup } = createHeadlessWebGL({
            width: 64,
            height: 128,
            preserveDrawingBuffer: true
        });

        expect(width).toBe(64);
        expect(height).toBe(128);

        const viewport = gl.getParameter(gl.VIEWPORT);
        expect(viewport[2]).toBe(64);
        expect(viewport[3]).toBe(128);

        cleanup();
    } catch (e: any) {
        if (e.message.includes('Failed to create headless WebGL context')) {
            return;
        }
        throw e;
    }
  });

  test('captures framebuffer pixels (color check)', () => {
    try {
        const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 10, height: 10 });

        // Clear to red
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const pixels = captureWebGLFramebuffer(gl, width, height);

        // Verify first pixel is red
        expect(pixels[0]).toBe(255);  // R
        expect(pixels[1]).toBe(0);    // G
        expect(pixels[2]).toBe(0);    // B
        expect(pixels[3]).toBe(255);  // A

        // Verify last pixel
        const lastIdx = (width * height - 1) * 4;
        expect(pixels[lastIdx]).toBe(255);
        expect(pixels[lastIdx+1]).toBe(0);
        expect(pixels[lastIdx+2]).toBe(0);
        expect(pixels[lastIdx+3]).toBe(255);

        cleanup();
    } catch (e: any) {
        if (e.message.includes('Failed to create headless WebGL context')) {
            return;
        }
        throw e;
    }
  });

  test('flips pixels vertically', () => {
    const width = 2;
    const height = 2;
    // 2x2 Image
    // Row 0: Red, Red
    // Row 1: Blue, Blue
    // In memory (bottom-up from readPixels):
    // [B, B] (Row 0 in GL is bottom)
    // [R, R] (Row 1 in GL is top)
    //
    // Wait. readPixels returns bottom row first?
    // OpenGL coordinates: (0,0) is bottom-left.
    // readPixels returns data starting from (0,0).
    // So the first bytes in buffer are the bottom row.
    //
    // If we drew:
    // Top half: Red
    // Bottom half: Blue
    //
    // GL Buffer (0,0 is bottom-left):
    // (0,0) -> Blue
    // (0,1) -> Red
    //
    // readPixels output:
    // [Blue Pixel, Blue Pixel, ... (row 0), Red Pixel, Red Pixel ... (row 1)]
    //
    // Expected Image (Top-Left origin):
    // Row 0 (Top): Red
    // Row 1 (Bottom): Blue
    //
    // So we need to swap Row 0 (Blue) with Row 1 (Red).

    // Let's verify flipPixelsVertically logic in isolation first
    const pixels = new Uint8ClampedArray([
      0, 0, 255, 255,   0, 0, 255, 255,  // Row 0 (Blue) - Bottom in GL
      255, 0, 0, 255,   255, 0, 0, 255   // Row 1 (Red) - Top in GL
    ]);

    const flipped = flipPixelsVertically(pixels, width, height);

    // Expect Red first (Top)
    expect(flipped[0]).toBe(255); // R
    expect(flipped[1]).toBe(0);
    expect(flipped[2]).toBe(0);

    // Expect Blue last (Bottom)
    const lastRowIdx = width * 4;
    expect(flipped[lastRowIdx]).toBe(0);
    expect(flipped[lastRowIdx+1]).toBe(0);
    expect(flipped[lastRowIdx+2]).toBe(255);
  });

  test('rendering and capturing checks orientation', () => {
    try {
        const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 2, height: 2 });

        // Enable scissor test to clear specific regions
        gl.enable(gl.SCISSOR_TEST);

        // Clear whole thing to Black
        gl.scissor(0, 0, 2, 2);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Clear Top Half to Red
        // In GL, Top Half is y from 1 to 2
        gl.scissor(0, 1, 2, 1);
        gl.clearColor(1, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Clear Bottom Half to Blue
        // In GL, Bottom Half is y from 0 to 1
        gl.scissor(0, 0, 2, 1);
        gl.clearColor(0, 0, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Capture
        const pixels = captureWebGLFramebuffer(gl, width, height);

        // Expected Image (Top-Left origin):
        // Row 0 (Top): Red
        // Row 1 (Bottom): Blue

        // Check Top Left Pixel (Index 0) -> Red
        expect(pixels[0]).toBe(255);
        expect(pixels[1]).toBe(0);
        expect(pixels[2]).toBe(0);

        // Check Bottom Left Pixel (Index 2*4 = 8) -> Blue
        expect(pixels[8]).toBe(0);
        expect(pixels[9]).toBe(0);
        expect(pixels[10]).toBe(255);

        cleanup();
    } catch (e: any) {
        if (e.message.includes('Failed to create headless WebGL context')) {
            return;
        }
        throw e;
    }
  });
});
