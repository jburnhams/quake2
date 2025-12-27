import { test, beforeAll } from 'vitest';
import { createRenderer } from '../../../../src/render/renderer.js';
import {
  createWebGLRenderTestSetup,
  expectSnapshot,
  createCheckerboardTexture,
  captureWebGLFramebuffer
} from '@quake2ts/test-utils';
import path from 'path';

// Use a relative path to the snapshot directory so it works in both local and CI environments
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('sprite: textured quad - checkerboard', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Create checkerboard texture
  const texData = createCheckerboardTexture(128, 128, 16, [1,0,0,1], [0,0,0,1]);
  // Use uploadPic directly if available or registerPic
  const pic = await renderer.registerPic('test-checker', texData.buffer);

  // Clear and render
  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  renderer.drawPic(64, 64, pic); // width/height implicit from pic
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-sprite-checkerboard',
    description: 'Red/black checkerboard sprite centered on black background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('sprite: basic rendering', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Create small 32x32 texture
  const texData = createCheckerboardTexture(32, 32, 8, [0,1,0,1], [0,0,1,1]); // Green/Blue
  const pic = await renderer.registerPic('test-wrap', texData.buffer);

  setup.gl.clearColor(0, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  renderer.begin2D();
  // Render simple sprite
  // Note: drawPic renders the texture at its original size unless scaling methods are exposed.
  // The current renderer implementation renders at 1:1 scale using pic dimensions.
  renderer.drawPic(112, 112, pic); // Centered-ish
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-sprite-simple',
    description: 'Simple 32x32 sprite',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('sprite: alpha blending', async () => {
  const setup = await createWebGLRenderTestSetup(256, 256);
  const renderer = createRenderer(setup.gl);

  // Background: Solid Red
  setup.gl.clearColor(1, 0, 0, 1);
  setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

  // Semi-transparent blue sprite (50% alpha)
  const texData = createCheckerboardTexture(128, 128, 64, [0,0,1,0.5], [0,0,1,0.5]);
  const pic = await renderer.registerPic('test-alpha', texData.buffer);

  renderer.begin2D();
  renderer.drawPic(64, 64, pic);
  renderer.end2D();

  const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

  await expectSnapshot(pixels, {
    name: '2d-sprite-alpha',
    description: 'Semi-transparent blue sprite over red background',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });

  setup.cleanup();
});

test('sprite: batch rendering', async () => {
    const setup = await createWebGLRenderTestSetup(256, 256);
    const renderer = createRenderer(setup.gl);

    const texData1 = createCheckerboardTexture(64, 64, 32, [1,0,0,1], [1,0,0,1]); // Red
    const pic1 = await renderer.registerPic('test-red', texData1.buffer);

    const texData2 = createCheckerboardTexture(64, 64, 32, [0,1,0,1], [0,1,0,1]); // Green
    const pic2 = await renderer.registerPic('test-green', texData2.buffer);

    setup.gl.clearColor(0, 0, 0, 1);
    setup.gl.clear(setup.gl.COLOR_BUFFER_BIT);

    renderer.begin2D();
    // Overlapping
    renderer.drawPic(50, 50, pic1);
    renderer.drawPic(80, 80, pic2);
    renderer.end2D();

    const pixels = captureWebGLFramebuffer(setup.gl, 256, 256);

    await expectSnapshot(pixels, {
      name: '2d-sprite-batch',
      description: 'Overlapping sprites (Red then Green)',
      width: 256,
      height: 256,
      updateBaseline: process.env.UPDATE_VISUAL === '1',
      snapshotDir
    });

    setup.cleanup();
});
