/**
 * Section 20-16: WebGL vs WebGPU Comparison Tests
 *
 * These tests validate visual consistency and feature parity between
 * WebGL and WebGPU renderers. The tests run WebGPU rendering and capture
 * baselines that can be compared against WebGL baselines when available.
 */
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import {
  initHeadlessWebGPU,
  captureTexture,
  expectSnapshot,
  compareSnapshots
} from '@quake2ts/test-utils';
import { Texture2D, TextureCubeMap, VertexBuffer, IndexBuffer } from '../../../src/render/webgpu/resources.js';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { BspSurfacePipeline } from '../../../src/render/webgpu/pipelines/bspPipeline.js';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';
import { mat4 } from 'gl-matrix';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGL vs WebGPU Comparison (Section 20-16)', () => {
  let webgpuContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;

  beforeAll(async () => {
    webgpuContext = await initHeadlessWebGPU();
  });

  afterAll(async () => {
    await webgpuContext.cleanup();
  });

  /**
   * Helper to create a colored cubemap
   */
  function createWebGPUCubemap(device: GPUDevice): TextureCubeMap {
    const cubemap = new TextureCubeMap(device, {
      size: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const colors = [
      [255, 0, 255, 255],   // +X
      [0, 255, 0, 255],     // -X
      [0, 0, 255, 255],     // +Y
      [255, 255, 0, 255],   // -Y
      [0, 255, 255, 255],   // +Z
      [255, 0, 0, 255]      // -Z
    ];

    for (let i = 0; i < 6; i++) {
      cubemap.uploadFace(i, new Uint8Array(colors[i]));
    }

    return cubemap;
  }

  describe('WebGPU Rendering Baselines', () => {
    test('2D solid rectangle rendering', async () => {
      const width = 256;
      const height = 256;

      const { device } = webgpuContext;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const spriteRenderer = new SpriteRenderer(device, format);

      const gpuTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const encoder = device.createCommandEncoder();
      spriteRenderer.setProjection(width, height);
      spriteRenderer.begin(encoder, gpuTexture.createView());

      // Draw a centered red rectangle
      spriteRenderer.drawSolidRect(78, 78, 100, 100, [1, 0, 0, 1]);

      spriteRenderer.end();
      device.queue.submit([encoder.finish()]);

      const webgpuResult = await captureTexture(device, gpuTexture, width, height);

      // Save WebGPU baseline for comparison with WebGL
      await expectSnapshot(webgpuResult, {
        name: 'comparison-2d-rect-webgpu',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      spriteRenderer.destroy();
      gpuTexture.destroy();
    });

    test('clear color rendering', async () => {
      const width = 256;
      const height = 256;

      const { device } = webgpuContext;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const gpuTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: gpuTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.2, g: 0.4, b: 0.6, a: 1.0 }
        }]
      });
      pass.end();
      device.queue.submit([encoder.finish()]);

      const webgpuResult = await captureTexture(device, gpuTexture, width, height);

      await expectSnapshot(webgpuResult, {
        name: 'comparison-clear-webgpu',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      gpuTexture.destroy();
    });
  });

  describe('Coordinate System Validation', () => {
    test('camera projection produces consistent results', async () => {
      const width = 256;
      const height = 256;

      // Create camera
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);
      camera.fov = 90;

      const cameraState = camera.toState();

      // Verify camera state contains required properties
      expect(cameraState.position).toBeDefined();
      expect(cameraState.angles).toBeDefined();
      expect(cameraState.fov).toBeDefined();
      expect(cameraState.aspect).toBeDefined();

      // Check position values
      expect(cameraState.position[2]).toBe(50); // Z position

      // Check FOV
      expect(cameraState.fov).toBe(90);

      // Check aspect ratio
      expect(cameraState.aspect).toBeCloseTo(width / height, 2);

      // Verify the deprecated viewProjectionMatrix accessor still works for legacy code
      const vp = camera.viewProjectionMatrix;
      expect(vp.length).toBe(16);

      // View-projection should not be identity
      const isIdentity = vp[0] === 1 && vp[5] === 1 && vp[10] === 1 && vp[15] === 1 &&
                         vp[1] === 0 && vp[2] === 0 && vp[3] === 0;
      expect(isIdentity).toBe(false);

      console.log('Camera state validated - matrices are non-identity');
    });
  });

  describe('Feature Parity Checklist', () => {
    test('validates all renderer features are implemented', async () => {
      const { device } = webgpuContext;
      const format = 'rgba8unorm' as GPUTextureFormat;

      // Test that all pipeline types can be created
      const pipelines: { name: string; create: () => { destroy: () => void } }[] = [
        { name: 'SpriteRenderer', create: () => new SpriteRenderer(device, format) },
        { name: 'SkyboxPipeline', create: () => new SkyboxPipeline(device, format) },
        { name: 'BspSurfacePipeline', create: () => new BspSurfacePipeline(device, format, 'depth24plus') },
      ];

      const results: { name: string; success: boolean; error?: string }[] = [];

      for (const { name, create } of pipelines) {
        try {
          const pipeline = create();
          pipeline.destroy();
          results.push({ name, success: true });
        } catch (e: any) {
          results.push({ name, success: false, error: e.message });
        }
      }

      // Log results
      console.log('Pipeline Creation Results:');
      for (const result of results) {
        console.log(`  ${result.name}: ${result.success ? '✓' : '✗'} ${result.error || ''}`);
      }

      // All pipelines should create successfully
      const failed = results.filter(r => !r.success);
      expect(failed.length).toBe(0);
    });

    test('validates WebGPU device capabilities', async () => {
      const { device } = webgpuContext;

      // Check required limits for Quake 2 rendering
      const limits = device.limits;

      const requiredCapabilities = [
        { name: 'maxTextureDimension2D', min: 2048, actual: limits.maxTextureDimension2D },
        { name: 'maxBindGroups', min: 4, actual: limits.maxBindGroups },
        { name: 'maxUniformBufferBindingSize', min: 65536, actual: limits.maxUniformBufferBindingSize },
        { name: 'maxSampledTexturesPerShaderStage', min: 8, actual: limits.maxSampledTexturesPerShaderStage },
      ];

      console.log('WebGPU Device Capabilities:');
      for (const cap of requiredCapabilities) {
        const meets = cap.actual >= cap.min;
        console.log(`  ${cap.name}: ${cap.actual} (required: ${cap.min}) ${meets ? '✓' : '✗'}`);
        expect(cap.actual).toBeGreaterThanOrEqual(cap.min);
      }
    });
  });

  describe('Frame-by-Frame Consistency', () => {
    test('renders consistent frames across multiple calls', async () => {
      const { device } = webgpuContext;
      const width = 128;
      const height = 128;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const spriteRenderer = new SpriteRenderer(device, format);
      const frames: Uint8ClampedArray[] = [];

      // Render the same scene 3 times
      for (let i = 0; i < 3; i++) {
        const gpuTexture = device.createTexture({
          size: [width, height],
          format: format,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });

        const encoder = device.createCommandEncoder();
        spriteRenderer.setProjection(width, height);
        spriteRenderer.begin(encoder, gpuTexture.createView());
        spriteRenderer.drawSolidRect(32, 32, 64, 64, [0.5, 0.5, 0.5, 1]);
        spriteRenderer.end();
        device.queue.submit([encoder.finish()]);

        const result = await captureTexture(device, gpuTexture, width, height);
        frames.push(result);

        gpuTexture.destroy();
      }

      // Compare first and second frames - should be identical
      let differences = 0;
      for (let i = 0; i < frames[0].length; i++) {
        if (frames[0][i] !== frames[1][i]) {
          differences++;
        }
      }

      // Frames should be identical (deterministic rendering)
      expect(differences).toBe(0);

      console.log('Frame consistency validated - identical renders');

      spriteRenderer.destroy();
    });
  });
});
