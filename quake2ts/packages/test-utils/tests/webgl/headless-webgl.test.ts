import { describe, test, expect, vi } from 'vitest';
import { createHeadlessWebGL, captureWebGLFramebuffer } from '../../src/setup/headless-webgl';

// Check if we can load gl and actually create a context
let glAvailable = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const createGL = require('gl');
  // Try creating a small context to see if system dependencies are met
  const gl = createGL(1, 1);
  if (gl) {
    glAvailable = true;
    const ext = gl.getExtension('STACKGL_destroy_context');
    if (ext) ext.destroy();
  }
} catch (e) {
  // gl not available or failed to initialize
}

describe('Headless WebGL Setup', () => {
  test.skipIf(!glAvailable)('creates headless WebGL context', () => {
    const { gl, width, height, cleanup } = createHeadlessWebGL();

    expect(gl).toBeDefined();
    expect(width).toBe(256);
    expect(height).toBe(256);

    // Check if it's a valid context-like object
    expect(gl.getParameter).toBeDefined();

    // Verify WebGL version (should be 1.0 compatible but we cast to 2.0 interface)
    // headless-gl implements WebGL 1.0.3.
    const version = gl.getParameter(gl.VERSION);
    expect(version).toContain('WebGL');

    cleanup();
  });

  test.skipIf(!glAvailable)('creates context with custom dimensions', () => {
    const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 64, height: 64 });

    expect(width).toBe(64);
    expect(height).toBe(64);

    // Verify drawing buffer size
    const glWidth = gl.drawingBufferWidth;
    const glHeight = gl.drawingBufferHeight;
    expect(glWidth).toBe(64);
    expect(glHeight).toBe(64);

    cleanup();
  });

  test.skipIf(!glAvailable)('captures framebuffer pixels', () => {
    const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 64, height: 64 });

    // Clear to red
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const pixels = captureWebGLFramebuffer(gl, width, height);

    expect(pixels.length).toBe(64 * 64 * 4);

    // Verify first pixel is red
    expect(pixels[0]).toBe(255);  // R
    expect(pixels[1]).toBe(0);    // G
    expect(pixels[2]).toBe(0);    // B
    expect(pixels[3]).toBe(255);  // A

    // Verify pixel in the middle
    const midIndex = (32 * 64 + 32) * 4;
    expect(pixels[midIndex]).toBe(255);
    expect(pixels[midIndex + 1]).toBe(0);
    expect(pixels[midIndex + 2]).toBe(0);
    expect(pixels[midIndex + 3]).toBe(255);

    cleanup();
  });

  test.skipIf(!glAvailable)('flips pixels vertically', () => {
    const { gl, width, height, cleanup } = createHeadlessWebGL({ width: 2, height: 2 });

    // We want to verify flip.
    // WebGL coordinates: (0,0) is bottom-left.
    // Image coordinates: (0,0) is top-left.

    // Let's scissor or viewport to color only bottom-left pixel in WebGL
    // which should be bottom-left in the image if NO flip, or top-left if flipped?
    // Wait.
    // WebGL texture/framebuffer origin is bottom-left.
    // readPixels reads from bottom row up.
    // So pixel at index 0 is bottom-left.
    // In PNG, pixel at index 0 is top-left.
    // So we need to flip rows.

    // Let's clear to black
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable Scissor test
    gl.enable(gl.SCISSOR_TEST);

    // Scissor the top-left quadrant in WebGL coordinates (x=0, y=1 for 2x2)
    // Wait, y=0 is bottom. So top-left is (0, 1).
    gl.scissor(0, 1, 1, 1);
    gl.clearColor(1, 0, 0, 1); // Red
    gl.clear(gl.COLOR_BUFFER_BIT);

    // So in WebGL buffer:
    // (0,1) [TL] is Red
    // (1,1) [TR] is Black
    // (0,0) [BL] is Black
    // (1,0) [BR] is Black

    // readPixels returns rows from bottom to top:
    // Row 0 (y=0): BL, BR
    // Row 1 (y=1): TL, TR

    // So raw pixels: [Black, Black, Red, Black]

    // We want output image (top-down):
    // Row 0 (Image Top): TL, TR -> Red, Black
    // Row 1 (Image Bottom): BL, BR -> Black, Black

    const pixels = captureWebGLFramebuffer(gl, width, height);

    // Check Top-Left (Index 0) - Should be Red
    expect(pixels[0]).toBe(255);
    expect(pixels[1]).toBe(0);
    expect(pixels[2]).toBe(0);
    expect(pixels[3]).toBe(255);

    // Check Top-Right (Index 4) - Should be Black
    expect(pixels[4]).toBe(0);

    // Check Bottom-Left (Index 8) - Should be Black
    expect(pixels[8]).toBe(0);

    // Check Bottom-Right (Index 12) - Should be Black
    expect(pixels[12]).toBe(0);

    cleanup();
  });
});
