import { test, beforeAll } from 'vitest';
import { captureTexture, initHeadlessWebGPU, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';

const snapshotDir = path.join(__dirname, '__snapshots__');

beforeAll(async () => {
  await initHeadlessWebGPU();
});

/**
 * Section 20-15: Render Settings Feature Parity
 *
 * Tests that all render settings (brightness, gamma, etc.) work correctly
 * through the renderer interface and produce expected visual output.
 */

test('render-settings: brightness adjustment', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Test normal brightness
  renderer.setBrightness(1.0);
  renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0] });

  // Draw a reference square in 2D
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.5, 0.5, 0.5, 1.0]);
  renderer.end2D();

  let pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-brightness-normal',
    width: 256,
    height: 256,
    snapshotDir,
  });

  // Test increased brightness
  renderer.setBrightness(1.5);
  renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0] });
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.5, 0.5, 0.5, 1.0]);
  renderer.end2D();

  pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-brightness-high',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});

test('render-settings: gamma correction', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Test normal gamma
  renderer.setGamma(1.0);
  renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0] });
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.5, 0.5, 0.5, 1.0]);
  renderer.end2D();

  let pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-gamma-normal',
    width: 256,
    height: 256,
    snapshotDir,
  });

  // Test increased gamma (2.2 is common for displays)
  renderer.setGamma(2.2);
  renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0] });
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.5, 0.5, 0.5, 1.0]);
  renderer.end2D();

  pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-gamma-high',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});

test('render-settings: underwater warp effect', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Enable underwater warp
  renderer.setUnderwaterWarp(true);
  renderer.renderFrame({ camera, clearColor: [0.2, 0.4, 0.6, 1.0], timeSeconds: 1.0 });

  // Draw a grid pattern to see the distortion
  renderer.begin2D();
  for (let x = 0; x < 256; x += 32) {
    renderer.drawfillRect(x, 0, 2, 256, [1, 1, 1, 1]);
  }
  for (let y = 0; y < 256; y += 32) {
    renderer.drawfillRect(0, y, 256, 2, [1, 1, 1, 1]);
  }
  renderer.end2D();

  const pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-underwater',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});

test('render-settings: combined settings', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Apply multiple settings at once
  renderer.setBrightness(1.3);
  renderer.setGamma(2.0);
  renderer.setUnderwaterWarp(true);

  renderer.renderFrame({ camera, clearColor: [0.3, 0.3, 0.3, 1.0], timeSeconds: 0.5 });
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.7, 0.7, 0.7, 1.0]);
  renderer.end2D();

  const pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-combined',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});

test('render-settings: state persistence across frames', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Set render state
  renderer.setBrightness(1.5);
  renderer.setGamma(2.0);

  // Render multiple frames - state should persist
  for (let i = 0; i < 3; i++) {
    renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0], timeSeconds: i * 0.016 });
    renderer.begin2D();
    renderer.drawfillRect(64 + i * 10, 64, 32, 32, [0.8, 0.8, 0.8, 1.0]);
    renderer.end2D();
  }

  // Capture final frame
  const pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-persistence',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});

test('render-settings: reset to defaults', async ({ expect }) => {
  const renderer = await createWebGPURenderer(undefined, { width: 256, height: 256 });
  const camera = new Camera(90, 1.0);
  camera.setPosition(0, 0, 100);

  // Set non-default values
  renderer.setBrightness(1.5);
  renderer.setGamma(2.2);
  renderer.setUnderwaterWarp(true);

  // Reset to defaults
  renderer.setBrightness(1.0);
  renderer.setGamma(1.0);
  renderer.setUnderwaterWarp(false);

  renderer.renderFrame({ camera, clearColor: [0.5, 0.5, 0.5, 1.0] });
  renderer.begin2D();
  renderer.drawfillRect(64, 64, 128, 128, [0.5, 0.5, 0.5, 1.0]);
  renderer.end2D();

  const pixels = await captureTexture(
    renderer.device,
    renderer['frameRenderer'].headlessTarget!,
    256,
    256
  );
  await expectSnapshot(pixels, {
    name: 'render-settings-defaults',
    width: 256,
    height: 256,
    snapshotDir,
  });

  renderer.dispose();
});
