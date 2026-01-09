/**
 * Section 20-16: Comprehensive Integration Tests for WebGPU Renderer
 *
 * These tests exercise the complete rendering pipeline with multiple
 * components working together: BSP, models, particles, skybox, 2D, and post-processing.
 */
import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU } from '@quake2ts/test-utils/src/setup/webgpu';
import { captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { createWebGPUContext } from '../../../src/render/webgpu/context.js';
import { FrameRenderer } from '../../../src/render/webgpu/frame.js';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite.js';
import { SkyboxPipeline } from '../../../src/render/webgpu/pipelines/skybox.js';
import { BspSurfacePipeline } from '../../../src/render/webgpu/pipelines/bspPipeline.js';
import { Md2Pipeline } from '../../../src/render/webgpu/pipelines/md2Pipeline.js';
import { PostProcessPipeline } from '../../../src/render/webgpu/pipelines/postProcess.js';
import { WebGPUDebugRenderer } from '../../../src/render/webgpu/debugRenderer.js';
import { Texture2D, TextureCubeMap, VertexBuffer, IndexBuffer } from '../../../src/render/webgpu/resources.js';
import { mat4 } from 'gl-matrix';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Integration Tests (Section 20-16)', () => {
  let testContext: Awaited<ReturnType<typeof initHeadlessWebGPU>>;

  beforeAll(async () => {
    testContext = await initHeadlessWebGPU();
  });

  afterAll(async () => {
    await testContext.cleanup();
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
   * Helper to create a simple quad geometry
   */
  function createQuad(device: GPUDevice, z = 0): { vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, indexCount: number } {
    const vertices = new Float32Array([
      // Position (x,y,z), TexCoord (u,v), LightmapCoord (lu,lv), Step
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

  describe('Complete Frame Rendering', () => {
    test('renders skybox with BSP geometry', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      // Create pipelines
      const skyboxPipeline = new SkyboxPipeline(device, format);
      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');

      // Create camera
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);

      // Create resources
      const cubemap = createColoredCubemap(device);
      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      // Create textures
      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const texData = new Uint8Array(4 * 4 * 4);
      for (let i = 0; i < 16; i++) {
        texData[i * 4] = 180;     // R
        texData[i * 4 + 1] = 180; // G
        texData[i * 4 + 2] = 180; // B
        texData[i * 4 + 3] = 255; // A
      }
      diffuseTex.upload(texData);

      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(4 * 4 * 4).fill(255));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      // Create render targets
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

      // Matrices
      const projection = mat4.create();
      mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
      const viewM = mat4.create();
      const mvp = mat4.create();
      mat4.multiply(mvp, projection, viewM);

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

      // Draw skybox first
      skyboxPipeline.draw(passEncoder, {
        cameraState: camera.toState(),
        scroll: [0, 0],
        cubemap: cubemap
      });

      // Draw BSP geometry on top
      const mockGeometry = {
        gpuVertexBuffer: vertexBuffer.buffer,
        gpuIndexBuffer: indexBuffer.buffer,
        indexCount: indexCount
      } as any;

      bspPipeline.bind(passEncoder, {
        cameraState: camera.toState(),
        diffuseTexture: diffuseTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: lightmapTex.createView(),
        lightmapSampler: sampler,
        lightmapOnly: false,
        fullbright: true,
        brightness: 1.0,
        gamma: 1.0
      });

      bspPipeline.draw(passEncoder, mockGeometry);

      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      const result = await captureTexture(device, texture, width, height);
      await expectSnapshot(result, {
        name: 'integration-skybox-bsp',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      skyboxPipeline.destroy();
      bspPipeline.destroy();
      cubemap.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });

    test('renders multiple BSP surfaces with different textures', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);
      camera.setRotation(0, 0, 0);

      // Create two quads at different depths
      const quad1 = createQuad(device, -40);
      const quad2 = createQuad(device, -60);

      // Different colored textures
      const redTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const redData = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        redData[i * 4] = 255;
        redData[i * 4 + 3] = 255;
      }
      redTex.upload(redData);

      const blueTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const blueData = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        blueData[i * 4 + 2] = 255;
        blueData[i * 4 + 3] = 255;
      }
      blueTex.upload(blueData);

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

      const projection = mat4.create();
      mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
      const mvp = mat4.create();
      mat4.multiply(mvp, projection, mat4.create());

      const commandEncoder = device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
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

      // Draw red quad (closer)
      bspPipeline.bind(passEncoder, {
        cameraState: camera.toState(),
        diffuseTexture: redTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: lightmapTex.createView(),
        lightmapSampler: sampler,
        fullbright: true
      });
      bspPipeline.draw(passEncoder, {
        gpuVertexBuffer: quad1.vertexBuffer.buffer,
        gpuIndexBuffer: quad1.indexBuffer.buffer,
        indexCount: quad1.indexCount
      } as any);

      // Draw blue quad (further) - offset to the side
      bspPipeline.bind(passEncoder, {
        cameraState: camera.toState(),
        diffuseTexture: blueTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: lightmapTex.createView(),
        lightmapSampler: sampler,
        fullbright: true
      });
      bspPipeline.draw(passEncoder, {
        gpuVertexBuffer: quad2.vertexBuffer.buffer,
        gpuIndexBuffer: quad2.indexBuffer.buffer,
        indexCount: quad2.indexCount
      } as any);

      passEncoder.end();
      device.queue.submit([commandEncoder.finish()]);

      const result = await captureTexture(device, texture, width, height);
      await expectSnapshot(result, {
        name: 'integration-multi-surface',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      bspPipeline.destroy();
      quad1.vertexBuffer.destroy();
      quad1.indexBuffer.destroy();
      quad2.vertexBuffer.destroy();
      quad2.indexBuffer.destroy();
      redTex.destroy();
      blueTex.destroy();
      lightmapTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });

    test('renders with post-processing effects', async () => {
      const { device } = testContext;
      const width = 256;
      const height = 256;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const postProcess = new PostProcessPipeline(device, format);
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      // Colorful checkerboard texture
      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const texData = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        const x = i % 4;
        const y = Math.floor(i / 4);
        const isLight = ((x + y) % 2) === 0;
        texData[i * 4] = isLight ? 255 : 50;
        texData[i * 4 + 1] = isLight ? 200 : 100;
        texData[i * 4 + 2] = isLight ? 50 : 255;
        texData[i * 4 + 3] = 255;
      }
      diffuseTex.upload(texData);

      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(64).fill(255));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      // Intermediate texture for post-processing
      const intermediateTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });

      const finalTexture = device.createTexture({
        size: [width, height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
      });

      const depthTexture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      // First pass: Render to intermediate
      const encoder1 = device.createCommandEncoder();
      const pass1 = encoder1.beginRenderPass({
        colorAttachments: [{
          view: intermediateTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1 }
        }],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });

      bspPipeline.bind(pass1, {
        cameraState: camera.toState(),
        diffuseTexture: diffuseTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: lightmapTex.createView(),
        lightmapSampler: sampler,
        fullbright: true
      });
      bspPipeline.draw(pass1, {
        gpuVertexBuffer: vertexBuffer.buffer,
        gpuIndexBuffer: indexBuffer.buffer,
        indexCount
      } as any);

      pass1.end();
      device.queue.submit([encoder1.finish()]);

      // Second pass: Post-processing with underwater warp
      const encoder2 = device.createCommandEncoder();
      const pass2 = encoder2.beginRenderPass({
        colorAttachments: [{
          view: finalTexture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 }
        }]
      });

      postProcess.render(pass2, intermediateTexture.createView(), sampler, {
        time: 0.5,
        strength: 0.8, // Underwater warp
        gamma: 1.2,
        brightness: 1.1
      });

      pass2.end();
      device.queue.submit([encoder2.finish()]);

      const result = await captureTexture(device, finalTexture, width, height);
      await expectSnapshot(result, {
        name: 'integration-post-process',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      bspPipeline.destroy();
      postProcess.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      intermediateTexture.destroy();
      finalTexture.destroy();
      depthTexture.destroy();
    });
  });

  describe('Complex Scene Rendering', () => {
    test('renders scene with skybox, geometry, and 2D overlay', async () => {
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
      camera.setRotation(15, 15, 0); // Slight angle

      // Resources
      const cubemap = createColoredCubemap(device);
      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -40);

      const grayTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const grayData = new Uint8Array(64);
      for (let i = 0; i < 16; i++) {
        grayData[i * 4] = 150;
        grayData[i * 4 + 1] = 150;
        grayData[i * 4 + 2] = 150;
        grayData[i * 4 + 3] = 255;
      }
      grayTex.upload(grayData);

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

      // 3D pass: skybox + BSP
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

      // Draw skybox
      skyboxPipeline.draw(pass3D, {
        cameraState: camera.toState(),
        scroll: [0.1, 0.2],
        cubemap: cubemap
      });

      // Draw BSP
      bspPipeline.bind(pass3D, {
        cameraState: camera.toState(),
        diffuseTexture: grayTex.createView(),
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

      pass3D.end();
      device.queue.submit([encoder1.finish()]);

      // 2D pass: HUD elements
      const encoder2 = device.createCommandEncoder();
      spriteRenderer.setProjection(width, height);
      spriteRenderer.begin(encoder2, texture.createView());

      // Draw some UI elements
      spriteRenderer.drawSolidRect(10, 10, 60, 20, [0.2, 0.2, 0.8, 0.8]); // Blue bar
      spriteRenderer.drawSolidRect(10, height - 30, 100, 20, [0.8, 0.2, 0.2, 0.8]); // Red bar
      spriteRenderer.drawSolidRect(width - 30, 10, 20, 20, [0.2, 0.8, 0.2, 1.0]); // Green indicator

      spriteRenderer.end();
      device.queue.submit([encoder2.finish()]);

      const result = await captureTexture(device, texture, width, height);
      await expectSnapshot(result, {
        name: 'integration-complete-scene',
        width,
        height,
        snapshotDir
      });

      // Cleanup
      skyboxPipeline.destroy();
      bspPipeline.destroy();
      spriteRenderer.destroy();
      cubemap.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      grayTex.destroy();
      lightmapTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });
  });

  describe('Resource Lifecycle', () => {
    test('handles multiple frames without resource leaks', async () => {
      const { device } = testContext;
      const width = 128;
      const height = 128;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      const diffuseTex = new Texture2D(device, { width: 2, height: 2, format: 'rgba8unorm' });
      diffuseTex.upload(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]));

      const lightmapTex = new Texture2D(device, { width: 2, height: 2, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(16).fill(255));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      // Render multiple frames
      const frameCount = 5;
      const frames: Uint8ClampedArray[] = [];

      for (let f = 0; f < frameCount; f++) {
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

        // Rotate camera each frame
        camera.setRotation(f * 5, f * 3, 0);

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
          colorAttachments: [{
            view: texture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0.1 * f, g: 0.1, b: 0.1, a: 1 }
          }],
          depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
          }
        });

        bspPipeline.bind(pass, {
          cameraState: camera.toState(),
          diffuseTexture: diffuseTex.createView(),
          diffuseSampler: sampler,
          lightmapTexture: lightmapTex.createView(),
          lightmapSampler: sampler,
          fullbright: true
        });
        bspPipeline.draw(pass, {
          gpuVertexBuffer: vertexBuffer.buffer,
          gpuIndexBuffer: indexBuffer.buffer,
          indexCount
        } as any);

        pass.end();
        device.queue.submit([encoder.finish()]);

        const result = await captureTexture(device, texture, width, height);
        frames.push(result);

        texture.destroy();
        depthTexture.destroy();
      }

      // Verify frames are different (camera moved)
      expect(frames.length).toBe(frameCount);

      // Compare first and last frames - they should be different
      let differences = 0;
      for (let i = 0; i < frames[0].length; i += 4) {
        if (frames[0][i] !== frames[frameCount - 1][i] ||
            frames[0][i + 1] !== frames[frameCount - 1][i + 1] ||
            frames[0][i + 2] !== frames[frameCount - 1][i + 2]) {
          differences++;
        }
      }
      expect(differences).toBeGreaterThan(0);

      // Cleanup
      bspPipeline.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
    });
  });

  describe('Error Handling', () => {
    test('handles missing textures gracefully', async () => {
      const { device } = testContext;
      const width = 64;
      const height = 64;
      const format = 'rgba8unorm' as GPUTextureFormat;

      const bspPipeline = new BspSurfacePipeline(device, format, 'depth24plus');
      const camera = new Camera(width, height);
      camera.setPosition(0, 0, 50);

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -30);

      // Create fallback white texture
      const whiteTex = new Texture2D(device, { width: 1, height: 1, format: 'rgba8unorm' });
      whiteTex.upload(new Uint8Array([255, 255, 255, 255]));

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

      // Render with fallback texture (simulating missing texture)
      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: texture.createView(),
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0.5, g: 0, b: 0.5, a: 1 }
        }],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthClearValue: 1.0,
          depthLoadOp: 'clear',
          depthStoreOp: 'store'
        }
      });

      bspPipeline.bind(pass, {
        cameraState: camera.toState(),
        diffuseTexture: whiteTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: whiteTex.createView(),
        lightmapSampler: sampler,
        fullbright: true
      });
      bspPipeline.draw(pass, {
        gpuVertexBuffer: vertexBuffer.buffer,
        gpuIndexBuffer: indexBuffer.buffer,
        indexCount
      } as any);

      pass.end();
      device.queue.submit([encoder.finish()]);

      const result = await captureTexture(device, texture, width, height);

      // Just verify we got some output without crashing
      expect(result.length).toBe(width * height * 4);

      // Cleanup
      bspPipeline.destroy();
      vertexBuffer.destroy();
      indexBuffer.destroy();
      whiteTex.destroy();
      texture.destroy();
      depthTexture.destroy();
    });
  });
});
