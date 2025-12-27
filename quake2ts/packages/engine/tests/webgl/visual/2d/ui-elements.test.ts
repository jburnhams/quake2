import { test } from 'vitest';
import { createRenderer } from '../../../../src/render/renderer.js';
import {
  createWebGLRenderTestSetup,
  expectSnapshot,
  captureWebGLFramebuffer
} from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('ui: filled rectangle - solid color', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  // Blue rectangle centered
  renderer.drawfillRect(64, 64, 128, 128, [0, 0, 1, 1]);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-ui-rect-solid',
    description: 'Solid blue rectangle on black',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('ui: multiple rectangles - overlapping', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  // Red
  renderer.drawfillRect(40, 40, 100, 100, [1, 0, 0, 1]);
  // Green overlapping
  renderer.drawfillRect(80, 80, 100, 100, [0, 1, 0, 1]);
  // Blue overlapping
  renderer.drawfillRect(120, 120, 100, 100, [0, 0, 1, 1]);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-ui-rect-overlap',
    description: 'Three overlapping rectangles (Red, Green, Blue)',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('ui: rectangle with transparency', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Background pattern: Checkered rects to show transparency
  setup.gl.clearColor(0.2, 0.2, 0.2, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  renderer.drawfillRect(0, 0, 256, 256, [1, 1, 1, 1]); // White background
  renderer.drawfillRect(0, 0, 128, 128, [0, 0, 0, 1]); // Black quadrant
  renderer.drawfillRect(128, 128, 128, 128, [0, 0, 0, 1]); // Black quadrant

  // Semi-transparent red overlay
  renderer.drawfillRect(64, 64, 128, 128, [1, 0, 0, 0.5]);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-ui-rect-alpha',
    description: 'Semi-transparent red rect over checkerboard background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('ui: gradient approximation', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  // Draw horizontal strips to simulate gradient from Black to White
  for (let i = 0; i < 256; i += 16) {
    const val = i / 255;
    renderer.drawfillRect(i, 0, 16, 256, [val, val, val, 1]);
  }
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-ui-gradient',
    description: 'Horizontal gradient stripes black to white',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});
