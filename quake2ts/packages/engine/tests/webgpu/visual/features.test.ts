/**
 * Feature combination tests for WebGPU renderer
 *
 * Tests different combinations of rendering features to ensure
 * CameraState works correctly in various scenarios.
 */
import { describe, test, beforeAll, afterAll } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';
import { captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Feature Combinations (Visual)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;

  beforeAll(async () => {
    testContext = await initHeadlessWebGPU();
  });

  /**
   * Helper to create a colored cubemap for testing
   */
  function createColoredCubemap(device: GPUDevice): TextureCubeMap {
    const cubemap = new TextureCubeMap(device, {
      size: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const colors = [
      [255, 0, 255, 255],   // +X (Magenta)
      [0, 255, 0, 255],     // -X (Green)
      [0, 0, 255, 255],     // +Y (Blue)
      [255, 255, 0, 255],   // -Y (Yellow)
      [0, 255, 255, 255],   // +Z (Cyan)
      [255, 0, 0, 255]      // -Z (Red)
    ];

    for (let i = 0; i < 6; i++) {
      cubemap.uploadFace(i, new Uint8Array(colors[i]));
    }

    return cubemap;
  }

  /**
   * Helper to create a grayscale cubemap
   */
  function createGrayscaleCubemap(device: GPUDevice): TextureCubeMap {
    const cubemap = new TextureCubeMap(device, {
      size: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const colors = [
      [200, 200, 200, 255], // +X (Light gray)
      [150, 150, 150, 255], // -X (Medium gray)
      [100, 100, 100, 255], // +Y (Dark gray)
      [180, 180, 180, 255], // -Y (Gray)
      [160, 160, 160, 255], // +Z (Gray)
      [120, 120, 120, 255]  // -Z (Gray)
    ];

    for (let i = 0; i < 6; i++) {
      cubemap.uploadFace(i, new Uint8Array(colors[i]));
    }

    return cubemap;
  }

  test('skybox-only: colored cubemap at origin', async () => {
    const { device } = testContext;
    const width = 256;
    const height = 256;
    const format = 'bgra8unorm' as GPUTextureFormat;

    const pipeline = new SkyboxPipeline(device, format);
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(0, 0, 0);

    const cubemap = createColoredCubemap(device);

    const texture = device.createTexture({
      size: [width, height],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    pipeline.draw(passEncoder, {
      cameraState: camera.toState(),
      scroll: [0, 0],
      cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    const result = await captureTexture(device, texture, width, height);
    await expectSnapshot(result, {
      name: 'features-skybox-only',
      width,
      height,
      snapshotDir
    });

    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
  });

  test('skybox-grayscale: monochrome environment', async () => {
    const { device } = testContext;
    const width = 256;
    const height = 256;
    const format = 'bgra8unorm' as GPUTextureFormat;

    const pipeline = new SkyboxPipeline(device, format);
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0); // Diagonal view

    const cubemap = createGrayscaleCubemap(device);

    const texture = device.createTexture({
      size: [width, height],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    pipeline.draw(passEncoder, {
      cameraState: camera.toState(),
      scroll: [0, 0],
      cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    const result = await captureTexture(device, texture, width, height);
    await expectSnapshot(result, {
      name: 'features-skybox-grayscale',
      width,
      height,
      snapshotDir
    });

    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
  });

  test('wide-fov: skybox with wide field of view', async () => {
    const { device } = testContext;
    const width = 256;
    const height = 256;
    const format = 'bgra8unorm' as GPUTextureFormat;

    const pipeline = new SkyboxPipeline(device, format);
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(0, 0, 0);
    camera.fov = 120; // Wide FOV

    const cubemap = createColoredCubemap(device);

    const texture = device.createTexture({
      size: [width, height],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    pipeline.draw(passEncoder, {
      cameraState: camera.toState(),
      scroll: [0, 0],
      cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    const result = await captureTexture(device, texture, width, height);
    await expectSnapshot(result, {
      name: 'features-wide-fov',
      width,
      height,
      snapshotDir
    });

    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
  });

  test('narrow-fov: skybox with narrow field of view', async () => {
    const { device } = testContext;
    const width = 256;
    const height = 256;
    const format = 'bgra8unorm' as GPUTextureFormat;

    const pipeline = new SkyboxPipeline(device, format);
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(0, 45, 0);
    camera.fov = 45; // Narrow FOV

    const cubemap = createColoredCubemap(device);

    const texture = device.createTexture({
      size: [width, height],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    pipeline.draw(passEncoder, {
      cameraState: camera.toState(),
      scroll: [0, 0],
      cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    const result = await captureTexture(device, texture, width, height);
    await expectSnapshot(result, {
      name: 'features-narrow-fov',
      width,
      height,
      snapshotDir
    });

    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
  });

  test('aspect-ratio: non-square viewport', async () => {
    const { device } = testContext;
    const width = 320;
    const height = 240; // 4:3 aspect ratio
    const format = 'bgra8unorm' as GPUTextureFormat;

    const pipeline = new SkyboxPipeline(device, format);
    const camera = new Camera(width, height);
    camera.setPosition(0, 0, 50);
    camera.setRotation(0, 0, 0);

    const cubemap = createColoredCubemap(device);

    const texture = device.createTexture({
      size: [width, height],
      format: format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
    });
    const view = texture.createView();

    const depthTexture = device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    const depthView = depthTexture.createView();

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: view,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }],
      depthStencilAttachment: {
        view: depthView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store'
      }
    });

    pipeline.draw(passEncoder, {
      cameraState: camera.toState(),
      scroll: [0, 0],
      cubemap: cubemap
    });

    passEncoder.end();
    device.queue.submit([commandEncoder.finish()]);

    const result = await captureTexture(device, texture, width, height);
    await expectSnapshot(result, {
      name: 'features-aspect-ratio',
      width,
      height,
      snapshotDir
    });

    pipeline.destroy();
    cubemap.destroy();
    texture.destroy();
    depthTexture.destroy();
  });
});
