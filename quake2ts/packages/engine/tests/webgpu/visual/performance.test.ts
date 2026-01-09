/**
 * Section 20-16: Performance Baseline Tests for WebGPU Renderer
 *
 * These tests establish performance baselines for the WebGPU renderer.
 * They measure frame time, draw call counts, and GPU memory usage.
 */
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';
import { captureTexture } from '@quake2ts/test-utils';
import { Texture2D, TextureCubeMap, VertexBuffer, IndexBuffer } from '../../../src/render/webgpu/resources.js';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { BspSurfacePipeline } from '../../../src/render/webgpu/pipelines/bspPipeline.js';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';
import { Md2Pipeline } from '../../../src/render/webgpu/pipelines/md2Pipeline.js';
import { PostProcessPipeline } from '../../../src/render/webgpu/pipelines/postProcess.js';

/**
 * Performance measurement result
 */
interface PerformanceResult {
  name: string;
  frameTimeMs: number;
  drawCalls: number;
  vertexCount: number;
  memoryUsageBytes?: number;
}

describe('WebGPU Performance Baselines (Section 20-16)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;

  beforeAll(async () => {
    testContext = await initHeadlessWebGPU();
  });

  afterAll(async () => {
    await testContext.cleanup();
  });

  /**
   * Helper to measure frame render time
   */
  async function measureFrameTime(
    renderFn: () => Promise<void>,
    warmupIterations = 3,
    measureIterations = 10
  ): Promise<number> {
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
      await renderFn();
    }

    // Measure
    const times: number[] = [];
    for (let i = 0; i < measureIterations; i++) {
      const start = performance.now();
      await renderFn();
      const end = performance.now();
      times.push(end - start);
    }

    // Return average
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  /**
   * Helper to create a colored cubemap
   */
  function createColoredCubemap(device: GPUDevice): TextureCubeMap {
    const cubemap = new TextureCubeMap(device, {
      size: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const colors = [
      [255, 0, 255, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 0, 255],
      [0, 255, 255, 255],
      [255, 0, 0, 255]
    ];

    for (let i = 0; i < 6; i++) {
      cubemap.uploadFace(i, new Uint8Array(colors[i]));
    }

    return cubemap;
  }

  /**
   * Helper to create quad geometry
   */
  function createQuad(device: GPUDevice, z = 0): { vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, indexCount: number } {
    const vertices = new Float32Array([
      -10, 10, z,  0, 0,  0, 0,  1,
      10, 10, z,   1, 0,  1, 0,  1,
      10, -10, z,  1, 1,  1, 1,  1,
      -10, -10, z, 0, 1,  0, 1,  1,
    ]);

    const indices = new Uint16Array([0, 3, 2, 0, 2, 1]);

    const vertexBuffer = new VertexBuffer(device, { size: vertices.byteLength });
    vertexBuffer.write(vertices);

    const indexBuffer = new IndexBuffer(device, { size: indices.byteLength });
    indexBuffer.write(indices);

    return { vertexBuffer, indexBuffer, indexCount: 6 };
  }

  describe('Single Pipeline Performance', () => {
    test('skybox rendering performance', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const pipeline = new SkyboxPipeline(device, format);
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const cubemap = createColoredCubemap(device);

      const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const depthTexture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      const renderFrame = async () => {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });

        pipeline.draw(pass, {
          cameraState: camera.toState(),
          scroll: [0, 0],
          cubemap: cubemap
        });

        pass.end();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
      };

      const avgTime = await measureFrameTime(renderFrame);

      console.log(`Skybox rendering: ${avgTime.toFixed(2)}ms avg`);

      // Baseline: Skybox should render in under 5ms on most hardware
      // This is a soft expectation - CI environments may vary
      expect(avgTime).toBeLessThan(50); // Very generous for CI

      // Cleanup
      pipeline.destroy();
      cubemap.destroy();
      texture.destroy();
      depthTexture.destroy();
    });

    test('BSP surface rendering performance', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const pipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      diffuseTex.upload(new Uint8Array(64).fill(200));

      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(64).fill(255));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const depthTexture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      const renderFrame = async () => {
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 }
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });

        pipeline.bind(pass, {
          cameraState: camera.toState(),
          diffuseTexture: diffuseTex.createView(),
          diffuseSampler: sampler,
          lightmapTexture: lightmapTex.createView(),
          lightmapSampler: sampler,
          fullbright: true
        });

        pipeline.draw(pass, {
          gpuVertexBuffer: vertexBuffer.buffer,
          gpuIndexBuffer: indexBuffer.buffer,
          indexCount
        } as any);

        pass.end();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
      };

      const avgTime = await measureFrameTime(renderFrame);

      console.log(`BSP surface rendering: ${avgTime.toFixed(2)}ms avg`);

      expect(avgTime).toBeLessThan(50);

      // Cleanup
      pipeline.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });

    test('2D sprite rendering performance', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const spriteRenderer = new SpriteRenderer(device, format);

      const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const renderFrame = async () => {
        const encoder = device.createCommandEncoder();
        spriteRenderer.setProjection(width, height);
        spriteRenderer.begin(encoder, texture.createView());

        // Draw multiple sprites
        for (let i = 0; i < 50; i++) {
          const x = (i % 10) * 25;
          const y = Math.floor(i / 10) * 50;
          spriteRenderer.drawSolidRect(x, y, 20, 40, [i / 50, 0.5, 1 - i / 50, 1]);
        }

        spriteRenderer.end();
        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();
      };

      const avgTime = await measureFrameTime(renderFrame);

      console.log(`2D sprite rendering (50 rects): ${avgTime.toFixed(2)}ms avg`);

      expect(avgTime).toBeLessThan(50);

      // Cleanup
      spriteRenderer.destroy();
      texture.destroy();
    });
  });

  describe('Multi-Pipeline Performance', () => {
    test('combined scene rendering performance', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      // Create all pipelines
      const skyboxPipeline = new SkyboxPipeline(device, format);
      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const spriteRenderer = new SpriteRenderer(device, format);

      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const cubemap = createColoredCubemap(device);
      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      diffuseTex.upload(new Uint8Array(64).fill(180));

      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(64).fill(255));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      const texture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const depthTexture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      let drawCalls = 0;

      const renderFrame = async () => {
        drawCalls = 0;

        // Pass 1: 3D scene
        const encoder1 = device.createCommandEncoder();
        const pass3D = encoder1.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 }
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });

        // Skybox
        skyboxPipeline.draw(pass3D, {
          cameraState: camera.toState(),
          scroll: [0, 0],
          cubemap: cubemap
        });
        drawCalls++;

        // BSP
        bspPipeline.bind(pass3D, {
          cameraState: camera.toState(),
          diffuseTexture: diffuseTex.createView(),
          diffuseSampler: sampler,
          lightmapTexture: lightmapTex.createView(),
          lightmapSampler: sampler,
          fullbright: true
        });
        bspPipeline.draw(pass3D, {
          gpuVertexBuffer: vertexBuffer.buffer,
          gpuIndexBuffer: indexBuffer.buffer,
          indexCount
        } as any);
        drawCalls++;

        pass3D.end();
        device.queue.submit([encoder1.finish()]);

        // Pass 2: HUD
        const encoder2 = device.createCommandEncoder();
        spriteRenderer.setProjection(width, height);
        spriteRenderer.begin(encoder2, texture.createView());

        for (let i = 0; i < 10; i++) {
          spriteRenderer.drawSolidRect(i * 25, height - 20, 20, 15, [0.8, 0.2, 0.2, 0.8]);
          drawCalls++;
        }

        spriteRenderer.end();
        device.queue.submit([encoder2.finish()]);

        await device.queue.onSubmittedWorkDone();
      };

      const avgTime = await measureFrameTime(renderFrame);

      console.log(`Combined scene rendering: ${avgTime.toFixed(2)}ms avg, ${drawCalls} draw calls`);

      // Baseline: Combined scene should render reasonably fast
      expect(avgTime).toBeLessThan(100);
      expect(drawCalls).toBeGreaterThan(0);

      // Cleanup
      skyboxPipeline.destroy();
      bspPipeline.destroy();
      spriteRenderer.destroy();
      cubemap.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });
  });

  describe('Resource Management Performance', () => {
    test('texture creation and upload performance', async () => {
      const { device } = testContext;
      const textureCount = 20;
      const textureSize = 64;

      const textures: Texture2D[] = [];
      const data = new Uint8Array(textureSize * textureSize * 4).fill(128);

      const start = performance.now();

      for (let i = 0; i < textureCount; i++) {
        const tex = new Texture2D(device, {
          width: textureSize,
          height: textureSize,
          format: 'rgba8unorm'
        });
        tex.upload(data);
        textures.push(tex);
      }

      await device.queue.onSubmittedWorkDone();
      const end = performance.now();

      const avgTime = (end - start) / textureCount;

      console.log(`Texture creation: ${avgTime.toFixed(2)}ms avg per ${textureSize}x${textureSize} texture`);

      // Baseline: Texture creation should be fast
      expect(avgTime).toBeLessThan(10);

      // Cleanup
      for (const tex of textures) {
        tex.destroy();
      }
    });

    test('buffer creation performance', async () => {
      const { device } = testContext;
      const bufferCount = 50;
      const bufferSize = 4096;

      const buffers: VertexBuffer[] = [];
      const data = new Float32Array(bufferSize / 4).fill(1.0);

      const start = performance.now();

      for (let i = 0; i < bufferCount; i++) {
        const buf = new VertexBuffer(device, { size: bufferSize });
        buf.write(data);
        buffers.push(buf);
      }

      await device.queue.onSubmittedWorkDone();
      const end = performance.now();

      const avgTime = (end - start) / bufferCount;

      console.log(`Buffer creation: ${avgTime.toFixed(2)}ms avg per ${bufferSize} byte buffer`);

      expect(avgTime).toBeLessThan(5);

      // Cleanup
      for (const buf of buffers) {
        buf.destroy();
      }
    });
  });

  describe('Performance Report Summary', () => {
    test('generates performance summary', async () => {
      const { device } = testContext;

      // Collect device info
      const limits = device.limits;

      const summary = {
        deviceInfo: {
          maxTextureDimension2D: limits.maxTextureDimension2D,
          maxBindGroups: limits.maxBindGroups,
          maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
        },
        benchmarks: {
          // These would be populated by running the tests above
          skyboxMs: 'See individual test results',
          bspMs: 'See individual test results',
          spriteMs: 'See individual test results',
          combinedMs: 'See individual test results',
        },
        recommendations: [] as string[],
      };

      // Add recommendations based on limits
      if (limits.maxTextureDimension2D < 4096) {
        summary.recommendations.push('Consider optimizing texture sizes for limited hardware');
      }

      console.log('\n=== WebGPU Performance Summary ===');
      console.log('Device Limits:');
      console.log(`  Max Texture Size: ${summary.deviceInfo.maxTextureDimension2D}`);
      console.log(`  Max Bind Groups: ${summary.deviceInfo.maxBindGroups}`);
      console.log(`  Max Uniform Buffer: ${summary.deviceInfo.maxUniformBufferBindingSize}`);

      if (summary.recommendations.length > 0) {
        console.log('Recommendations:');
        for (const rec of summary.recommendations) {
          console.log(`  - ${rec}`);
        }
      }

      expect(summary.deviceInfo.maxTextureDimension2D).toBeGreaterThan(0);
    });
  });
});
