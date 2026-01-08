/**
 * Comprehensive camera angle tests for WebGPU renderer
 *
 * Tests all major camera orientations to ensure correct matrix building
 * and coordinate transformations.
 */
import { describe, test, beforeAll } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';
import { captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import path from 'path';

const CAMERA_TEST_POSITIONS = [
  { pos: [0, 0, 50] as [number, number, number], angles: [0, 0, 0] as [number, number, number], label: 'origin-forward' },
  { pos: [0, 0, 50] as [number, number, number], angles: [45, 0, 0] as [number, number, number], label: 'origin-down' },
  { pos: [0, 0, 50] as [number, number, number], angles: [-45, 0, 0] as [number, number, number], label: 'origin-up' },
  { pos: [0, 0, 50] as [number, number, number], angles: [0, 45, 0] as [number, number, number], label: 'origin-right' },
  { pos: [0, 0, 50] as [number, number, number], angles: [0, -45, 0] as [number, number, number], label: 'origin-left' },
  { pos: [0, 0, 50] as [number, number, number], angles: [45, 45, 0] as [number, number, number], label: 'origin-diagonal-pos' },
  { pos: [0, 0, 50] as [number, number, number], angles: [-45, -45, 0] as [number, number, number], label: 'origin-diagonal-neg' },
  { pos: [0, 0, 50] as [number, number, number], angles: [30, 135, 0] as [number, number, number], label: 'origin-oblique' },
  { pos: [0, 0, 50] as [number, number, number], angles: [0, 90, 0] as [number, number, number], label: 'origin-right-90' },
  { pos: [0, 0, 50] as [number, number, number], angles: [0, 180, 0] as [number, number, number], label: 'origin-back' },
  { pos: [0, 0, 50] as [number, number, number], angles: [0, 270, 0] as [number, number, number], label: 'origin-left-90' },
  { pos: [0, 0, 50] as [number, number, number], angles: [90, 0, 0] as [number, number, number], label: 'origin-straight-down' },
  { pos: [0, 0, 50] as [number, number, number], angles: [-90, 0, 0] as [number, number, number], label: 'origin-straight-up' },
];

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Camera Angles (Visual)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;

  beforeAll(async () => {
    testContext = await initHeadlessWebGPU();
  });

  /**
   * Helper to create a colored cubemap for testing
   * Each face has a distinct color to make orientation clear
   */
  function createColoredCubemap(device: GPUDevice): TextureCubeMap {
    const cubemap = new TextureCubeMap(device, {
      size: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    // Distinctive colors for each face
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

  for (const { pos, angles, label } of CAMERA_TEST_POSITIONS) {
    test(`renders correctly at ${label} (pitch=${angles[0]}, yaw=${angles[1]}, roll=${angles[2]})`, async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'bgra8unorm' as GPUTextureFormat;

      // Create pipeline
      const pipeline = new SkyboxPipeline(device, format);

      // Create camera with test position/rotation
      const camera = new Camera(width, height);
      camera.setPosition(...pos);
      camera.setRotation(...angles);

      // Create colored cubemap
      const cubemap = createColoredCubemap(device);

      // Create render target
      const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });
      const view = texture.createView();

      // Create depth texture
      const depthTexture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });
      const depthView = depthTexture.createView();

      // Render
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

      // Capture and verify
      const result = await captureTexture(device, texture, width, height);

      await expectSnapshot(result, {
        name: `camera-${label}`,
        width,
        height,
        snapshotDir
      });

      // Cleanup
      pipeline.destroy();
      cubemap.destroy();
      texture.destroy();
      depthTexture.destroy();
    });
  }
});
