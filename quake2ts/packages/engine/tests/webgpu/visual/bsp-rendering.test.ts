import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context';
import { BspSurfacePipeline } from '../../../src/render/webgpu/pipelines/bspPipeline';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';
import { initHeadlessWebGPU, HeadlessWebGPUSetup, expectSnapshot } from '@quake2ts/test-utils/src/setup/webgpu';
import { Texture2D, VertexBuffer, IndexBuffer } from '../../../src/render/webgpu/resources';
import { mat4, vec3 } from 'gl-matrix';
import path from 'path';
import fs from 'fs';

// Helper to create a simple quad geometry
function createQuad(device: GPUDevice, z = 0): { vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, indexCount: number } {
  // Pos(3), Tex(2), LM(2), Step(1)
  // Interleaved: x, y, z, u, v, lu, lv, step
  const vertices = new Float32Array([
    // TL
    -10, 10, z,  0, 0,  0, 0,  1,
    // TR
    10, 10, z,   1, 0,  1, 0,  1,
    // BR
    10, -10, z,  1, 1,  1, 1,  1,
    // BL
    -10, -10, z, 0, 1,  0, 1,  1,
  ]);

  const indices = new Uint16Array([
    0, 1, 2,
    0, 2, 3
  ]);

  const vertexBuffer = new VertexBuffer(device, { size: vertices.byteLength });
  vertexBuffer.write(vertices);

  const indexBuffer = new IndexBuffer(device, { size: indices.byteLength });
  indexBuffer.write(indices);

  return { vertexBuffer, indexBuffer, indexCount: 6 };
}

describe('BspSurfacePipeline Visual (Headless)', () => {
  let gpuSetup: HeadlessWebGPUSetup | null = null;
  const snapshotDir = path.join(__dirname, '__snapshots__');
  const updateBaseline = process.env.UPDATE_VISUAL === '1';

  beforeAll(async () => {
    try {
      gpuSetup = await initHeadlessWebGPU();
      if (!fs.existsSync(snapshotDir)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
      }
    } catch (error) {
      console.warn('Skipping WebGPU visual tests: ' + error);
    }
  });

  afterAll(async () => {
    if (gpuSetup) {
      await gpuSetup.cleanup();
    }
  });

  it('renders a textured quad', async () => {
    if (!gpuSetup) return;

    const width = 256;
    const height = 256;
    const context = await createWebGPUContext(undefined, { width, height });
    const device = context.device;

    const { texture, view } = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');
    const pipeline = new BspSurfacePipeline(device, 'rgba8unorm', 'depth24plus');

    // Create resources
    const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -50);

    // Create dummy textures
    const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
    const redData = new Uint8Array(4 * 4 * 4).fill(255);
    // Make it checkerboard red/blue
    for(let i=0; i<16; i++) {
        const isRed = (i % 2) === 0;
        redData[i*4] = isRed ? 255 : 0;
        redData[i*4+1] = 0;
        redData[i*4+2] = isRed ? 0 : 255;
        redData[i*4+3] = 255;
    }
    diffuseTex.upload(redData);

    const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
    const whiteData = new Uint8Array(4 * 4 * 4).fill(255);
    lightmapTex.upload(whiteData);

    const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

    // Matrices
    const projection = mat4.create();
    mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
    const viewM = mat4.create(); // Identity camera at 0,0,0
    const mvp = mat4.create();
    mat4.multiply(mvp, projection, viewM);

    // Render
    const encoder = device.createCommandEncoder();

    // We need depth buffer
    const depthTexture = device.createTexture({
        size: [width, height, 1],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });

    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view,
            loadOp: 'clear',
            clearValue: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
            storeOp: 'store'
        }],
        depthStencilAttachment: {
            view: depthTexture.createView(),
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store'
        }
    });

    // Mock geometry object conforming to BspSurfaceGeometry structure used by pipeline
    const mockGeometry = {
        gpuVertexBuffer: vertexBuffer.buffer,
        gpuIndexBuffer: indexBuffer.buffer,
        indexCount: indexCount
    } as any;

    pipeline.bind(pass, {
        modelViewProjection: mvp,
        diffuseTexture: diffuseTex.createView(),
        diffuseSampler: sampler,
        lightmapTexture: lightmapTex.createView(),
        lightmapSampler: sampler,
        lightmapOnly: false,
        fullbright: true, // Disable lighting for simple texture test
        brightness: 1.0,
        gamma: 1.0
    });

    pipeline.draw(pass, mockGeometry);
    pass.end();

    device.queue.submit([encoder.finish()]);

    const pixels = await captureRenderTarget(device, texture);

    await expectSnapshot(pixels, {
        name: 'bsp-simple-textured',
        width,
        height,
        snapshotDir,
        updateBaseline
    });

    // Cleanup
    vertexBuffer.destroy();
    indexBuffer.destroy();
    diffuseTex.destroy();
    lightmapTex.destroy();
    depthTexture.destroy();
    texture.destroy();
  });

  it('renders with lightmap', async () => {
      if (!gpuSetup) return;

      const width = 256;
      const height = 256;
      const context = await createWebGPUContext(undefined, { width, height });
      const device = context.device;

      const { texture, view } = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');
      const pipeline = new BspSurfacePipeline(device, 'rgba8unorm', 'depth24plus');

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -50);

      // White base
      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      diffuseTex.upload(new Uint8Array(4 * 4 * 4).fill(255));

      // Green lightmap (left side dark, right side bright green)
      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      const lmData = new Uint8Array(4 * 4 * 4).fill(0);
      for(let i=0; i<16; i++) {
          if ((i % 4) >= 2) { // Right side
              lmData[i*4+1] = 255; // Green
          }
      }
      lightmapTex.upload(lmData);

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      const projection = mat4.create();
      mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
      const mvp = mat4.create();
      mat4.multiply(mvp, projection, mat4.create());

      const encoder = device.createCommandEncoder();
      const depthTexture = device.createTexture({
          size: [width, height, 1],
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      const pass = encoder.beginRenderPass({
          colorAttachments: [{
              view,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store'
          }],
          depthStencilAttachment: {
              view: depthTexture.createView(),
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
          }
      });

      const mockGeometry = {
          gpuVertexBuffer: vertexBuffer.buffer,
          gpuIndexBuffer: indexBuffer.buffer,
          indexCount: indexCount
      } as any;

      pipeline.bind(pass, {
          modelViewProjection: mvp,
          diffuseTexture: diffuseTex.createView(),
          diffuseSampler: sampler,
          lightmapTexture: lightmapTex.createView(),
          lightmapSampler: sampler,
          lightmapOnly: false,
          fullbright: false, // Enable lighting
          brightness: 1.0,
          gamma: 1.0,
          // Map layer 0 to style 0
          styleLayers: [0, -1, -1, -1],
          styleValues: [1.0]
      });

      pipeline.draw(pass, mockGeometry);
      pass.end();

      device.queue.submit([encoder.finish()]);

      const pixels = await captureRenderTarget(device, texture);

      await expectSnapshot(pixels, {
          name: 'bsp-lightmapped',
          width,
          height,
          snapshotDir,
          updateBaseline
      });

      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      depthTexture.destroy();
      texture.destroy();
    });

    it('renders with dynamic light', async () => {
      if (!gpuSetup) return;

      const width = 256;
      const height = 256;
      const context = await createWebGPUContext(undefined, { width, height });
      const device = context.device;

      const { texture, view } = createHeadlessRenderTarget(device, width, height, 'rgba8unorm');
      const pipeline = new BspSurfacePipeline(device, 'rgba8unorm', 'depth24plus');

      const { vertexBuffer, indexBuffer, indexCount } = createQuad(device, -50);

      // Gray base
      const diffuseTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      diffuseTex.upload(new Uint8Array(4 * 4 * 4).fill(128));

      // Black lightmap
      const lightmapTex = new Texture2D(device, { width: 4, height: 4, format: 'rgba8unorm' });
      lightmapTex.upload(new Uint8Array(4 * 4 * 4).fill(0));

      const sampler = device.createSampler({ minFilter: 'nearest', magFilter: 'nearest' });

      const projection = mat4.create();
      mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
      const mvp = mat4.create();
      mat4.multiply(mvp, projection, mat4.create());

      const encoder = device.createCommandEncoder();
      const depthTexture = device.createTexture({
          size: [width, height, 1],
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      const pass = encoder.beginRenderPass({
          colorAttachments: [{
              view,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
              storeOp: 'store'
          }],
          depthStencilAttachment: {
              view: depthTexture.createView(),
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
          }
      });

      const mockGeometry = {
          gpuVertexBuffer: vertexBuffer.buffer,
          gpuIndexBuffer: indexBuffer.buffer,
          indexCount: indexCount
      } as any;

      // Red dynamic light at center
      const dlight = {
          origin: { x: 0, y: 0, z: -40 } as any, // 10 units in front of wall at -50
          color: { x: 1, y: 0, z: 0 } as any,
          intensity: 200,
          die: 0
      };

      pipeline.bind(pass, {
          modelViewProjection: mvp,
          diffuseTexture: diffuseTex.createView(),
          diffuseSampler: sampler,
          lightmapTexture: lightmapTex.createView(),
          lightmapSampler: sampler,
          lightmapOnly: false,
          fullbright: false,
          brightness: 1.0,
          gamma: 1.0,
          dlights: [dlight]
      });

      pipeline.draw(pass, mockGeometry);
      pass.end();

      device.queue.submit([encoder.finish()]);

      const pixels = await captureRenderTarget(device, texture);

      await expectSnapshot(pixels, {
          name: 'bsp-dynamic-light',
          width,
          height,
          snapshotDir,
          updateBaseline
      });

      vertexBuffer.destroy();
      indexBuffer.destroy();
      diffuseTex.destroy();
      lightmapTex.destroy();
      depthTexture.destroy();
      texture.destroy();
    });
});
