import { test, beforeAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer';
import { Camera } from '../../../src/render/camera';
import { mat4 } from 'gl-matrix';
import { Texture2D } from '../../../src/render/webgpu/resources';
import { captureTexture, initHeadlessWebGPU, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

// NOTE: WebGPU tests require mesa-vulkan-drivers to be installed
// On Ubuntu/Debian: sudo apt-get install -y --no-install-recommends mesa-vulkan-drivers
// This provides lavapipe, a CPU-based Vulkan implementation for headless rendering
// See CLAUDE.md for detailed setup instructions

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

// Initialize WebGPU environment once for all tests
beforeAll(async () => {
  await initHeadlessWebGPU();
});

test('2d-renderer: drawfillRect - solid blue rectangle', async () => {
  // Create renderer in headless mode
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  // Render frame with 2D drawing
  renderer.renderFrame({
    camera,
    clearColor: [0, 0, 0, 1],
    onDraw2D: () => {
      renderer.begin2D();
      // Test drawfillRect - draws centered blue rectangle
      renderer.drawfillRect(64, 64, 128, 128, [0, 0, 1, 1]);
      renderer.end2D();
    }
  });

  // Capture rendered output
  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: '2d-renderer-fillrect',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});

test('2d-renderer: drawPic - textured quad with checkerboard', async () => {
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  // Create 4x4 red/black checkerboard texture
  const testTexture = new Texture2D(renderer.device, {
    width: 4,
    height: 4,
    format: 'rgba8unorm',
    label: 'test-checkerboard'
  });

  const checkerData = new Uint8Array(4 * 4 * 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const idx = (y * 4 + x) * 4;
      const isRed = (x + y) % 2 === 0;
      checkerData[idx + 0] = isRed ? 255 : 0;   // R
      checkerData[idx + 1] = 0;                 // G
      checkerData[idx + 2] = 0;                 // B
      checkerData[idx + 3] = 255;               // A
    }
  }
  testTexture.upload(checkerData);

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  renderer.renderFrame({
    camera,
    clearColor: [0, 0, 0, 1],
    onDraw2D: () => {
      renderer.begin2D();
      // Test drawPic - draws textured quad scaled to 128x128
      renderer.drawPic(64, 64, testTexture, [1, 1, 1, 1]);
      renderer.end2D();
    }
  });

  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: '2d-renderer-drawpic',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});

test('2d-renderer: drawPic with color tint', async () => {
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  // Create white 8x8 texture for tinting
  const whiteTexture = new Texture2D(renderer.device, {
    width: 8,
    height: 8,
    format: 'rgba8unorm',
    label: 'white-texture'
  });

  const whiteData = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 8 * 8 * 4; i += 4) {
    whiteData[i + 0] = 255;
    whiteData[i + 1] = 255;
    whiteData[i + 2] = 255;
    whiteData[i + 3] = 255;
  }
  whiteTexture.upload(whiteData);

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  renderer.renderFrame({
    camera,
    clearColor: [0, 0, 0, 1],
    onDraw2D: () => {
      renderer.begin2D();
      // Test color tinting - white texture with green color modulation
      renderer.drawPic(64, 64, whiteTexture, [0, 1, 0, 1]);
      renderer.end2D();
    }
  });

  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: '2d-renderer-tint',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});

test('2d-renderer: layered rendering with alpha blending', async () => {
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  renderer.renderFrame({
    camera,
    clearColor: [0, 0, 0, 1],
    onDraw2D: () => {
      renderer.begin2D();

      // Background: Solid blue rectangle
      renderer.drawfillRect(50, 50, 156, 156, [0, 0, 1, 1]);

      // Foreground: Semi-transparent red (50% alpha)
      // Tests alpha blending - should result in purple-ish blend
      renderer.drawfillRect(100, 100, 56, 56, [1, 0, 0, 0.5]);

      renderer.end2D();
    }
  });

  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: '2d-renderer-alpha',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});

test('2d-renderer: batched rectangles', async () => {
  const renderer = await createWebGPURenderer(undefined, {
    width: 256,
    height: 256,
    headless: true
  });

  const camera = new Camera(mat4.create());
  const frameRenderer = (renderer as any).frameRenderer;

  renderer.renderFrame({
    camera,
    clearColor: [0.1, 0.1, 0.1, 1], // Dark gray background
    onDraw2D: () => {
      renderer.begin2D();

      // Draw 4 colored squares in corners to test batching
      // Top-Left: Red
      renderer.drawfillRect(10, 10, 50, 50, [1, 0, 0, 1]);

      // Top-Right: Green
      renderer.drawfillRect(196, 10, 50, 50, [0, 1, 0, 1]);

      // Bottom-Left: Blue
      renderer.drawfillRect(10, 196, 50, 50, [0, 0, 1, 1]);

      // Bottom-Right: White
      renderer.drawfillRect(196, 196, 50, 50, [1, 1, 1, 1]);

      renderer.end2D();
    }
  });

  const pixels = await captureTexture(
    renderer.device,
    frameRenderer.headlessTarget,
    256,
    256
  );

  await expectSnapshot(pixels, {
    name: '2d-renderer-batched',
    width: 256,
    height: 256,
    updateBaseline,
    snapshotDir
  });

  renderer.dispose();
});
