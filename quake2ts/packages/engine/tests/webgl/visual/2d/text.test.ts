import { test } from 'vitest';
import { createRenderer } from '../../../../src/render/renderer.js';
import {
  createWebGLRenderTestSetup,
  expectSnapshot,
  createCheckerboardTexture,
  captureWebGLFramebuffer
} from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

/**
 * Creates a simple bitmap font texture for testing.
 * 8x8 chars, laid out in a grid.
 * We'll just make a grid pattern so we can see "characters".
 */
function createTestFont(width: number, height: number): Uint8ClampedArray {
  // Use checkerboard as base, but ensure each 8x8 cell is distinct
  const data = new Uint8ClampedArray(width * height * 4);
  const charWidth = 8;
  const charHeight = 8;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const col = Math.floor(x / charWidth);
      const row = Math.floor(y / charHeight);

      // Border for each char
      const isBorder = (x % charWidth === 0) || (y % charHeight === 0) || (x % charWidth === 7) || (y % charHeight === 7);

      let r = 255, g = 255, b = 255, a = 255;

      if (isBorder) {
        r = 0; g = 0; b = 0; // Black border
      } else {
        // Different inner color based on position to distinguish "chars"
        r = (col * 32) % 255;
        g = (row * 32) % 255;
        b = 128;
      }

      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return data;
}

test('text: simple string', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Register font texture (must contain 'conchars' to be picked up as font)
  const fontData = createTestFont(256, 128);
  await renderer.registerPic('pics/conchars', fontData.buffer);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  renderer.drawString(10, 10, "HELLO WORLD");
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-text-simple',
    description: 'Text "HELLO WORLD" with debug font',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('text: multi-line', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  const fontData = createTestFont(256, 128);
  await renderer.registerPic('pics/conchars', fontData.buffer);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  renderer.drawString(10, 10, "LINE ONE");
  renderer.drawString(10, 20, "LINE TWO");
  renderer.drawString(10, 30, "LINE THREE");
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-text-multiline',
    description: 'Three lines of text',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('text: colored', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  const fontData = createTestFont(256, 128);
  await renderer.registerPic('pics/conchars', fontData.buffer);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  // Using explicit color argument
  renderer.drawString(10, 10, "RED TEXT", [1, 0, 0, 1]);
  renderer.drawString(10, 30, "GREEN TEXT", [0, 1, 0, 1]);
  renderer.drawString(10, 50, "BLUE TEXT", [0, 0, 1, 1]);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-text-colored',
    description: 'Text rendered with different tint colors',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});
