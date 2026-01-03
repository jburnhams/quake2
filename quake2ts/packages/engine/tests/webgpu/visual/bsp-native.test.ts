import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context';
import { BspSurfacePipeline } from '../../../src/render/webgpu/pipelines/bspPipeline';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle } from '@quake2ts/test-utils';
import { expectSnapshot, expectAnimationSnapshot } from '@quake2ts/test-utils';
import { Texture2D, VertexBuffer, IndexBuffer } from '../../../src/render/webgpu/resources';
import { mat4, vec3 } from 'gl-matrix';
import { CameraState } from '../../../src/render/types/camera';
import path from 'path';
import fs from 'fs';

// Helper to create a simple quad geometry
function createQuad(device: GPUDevice, z = 0): { vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, indexCount: number } {
  // Pos(3), Tex(2), LM(2), Step(1)
  // Interleaved: x, y, z, u, v, lu, lv, step
  const vertices = new Float32Array([
    // TL (0)
    -10, 10, z,  0, 0,  0, 0,  1,
    // TR (1)
    10, 10, z,   1, 0,  1, 0,  1,
    // BR (2)
    10, -10, z,  1, 1,  1, 1,  1,
    // BL (3)
    -10, -10, z, 0, 1,  0, 1,  1,
  ]);

  // Use CCW winding for front-facing (assuming culling is enabled)
  // 0(TL) -> 3(BL) -> 2(BR)
  // 0(TL) -> 2(BR) -> 1(TR)
  const indices = new Uint16Array([
    0, 3, 2,
    0, 2, 1
  ]);

  const vertexBuffer = new VertexBuffer(device, { size: vertices.byteLength });
  vertexBuffer.write(vertices);

  const indexBuffer = new IndexBuffer(device, { size: indices.byteLength });
  indexBuffer.write(indices);

  return { vertexBuffer, indexBuffer, indexCount: 6 };
}

describe('BspSurfacePipeline Visual (Native CameraState)', () => {
  const lifecycle = createWebGPULifecycle();
  const snapshotDir = path.join(__dirname, '__snapshots__');
  const updateBaseline = process.env.UPDATE_VISUAL === '1';

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
  });

  afterAll(lifecycle.cleanup);

  it('renders a textured quad using CameraState', async () => {
    const width = 256;
    const height = 256;
    const context = await createWebGPUContext(undefined, { width, height });
    lifecycle.track(context.device);
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
        const x = i % 4;
        const y = Math.floor(i / 4);
        const isRed = ((x + y) % 2) === 0;
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

    // New: CameraState definition
    // To match the previous test result (where the camera WAS seeing the quad at Z=-50 from 0,0,0 with identity view)
    // we need to look Down. Pitch = 90.
    const cameraState: CameraState = {
        position: [0, 0, 0],
        angles: [90, 0, 0], // Pitch 90 = Down
        fov: 45,
        aspect: 1,
        near: 0.1,
        far: 100
    };

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

    const mockGeometry = {
        gpuVertexBuffer: vertexBuffer.buffer,
        gpuIndexBuffer: indexBuffer.buffer,
        indexCount: indexCount
    } as any;

    pipeline.bind(pass, {
        cameraState, // NEW
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
        name: 'bsp-native-camera',
        description: 'A simple textured quad rendered using CameraState.',
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
});
