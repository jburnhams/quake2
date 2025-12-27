import { describe, it, beforeAll, afterAll } from 'vitest';
import { Md2Pipeline, Md2MeshBuffers } from '../../../src/render/webgpu/pipelines/md2Pipeline.js';
import { Md2Model } from '../../../src/assets/md2.js';
import { mat4, vec3 } from 'gl-matrix';
import { Texture2D } from '../../../src/render/webgpu/resources.js';
import { createRenderTestSetup, expectAnimationSnapshot, expectSnapshot, initHeadlessWebGPU, HeadlessWebGPUSetup, captureTexture } from '@quake2ts/test-utils';
import path from 'path';
import fs from 'fs';

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

// Create a mock MD2 model with a simple triangle
function createMockModel(): Md2Model {
  const v1 = {
      position: { x: -10, y: -10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v2 = {
      position: { x: 10, y: -10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v3 = {
      position: { x: 0, y: 10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };

  const v1_next = {
      position: { x: -10, y: -10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v2_next = {
      position: { x: 10, y: -10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v3_next = {
      position: { x: 0, y: 10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };

  const frame0 = {
      scale: { x: 1, y: 1, z: 1 },
      translate: { x: 0, y: 0, z: 0 },
      name: 'frame0',
      vertices: [v1, v2, v3]
  };

  const frame1 = {
      scale: { x: 1, y: 1, z: 1 },
      translate: { x: 0, y: 0, z: 0 },
      name: 'frame1',
      vertices: [v1_next, v2_next, v3_next]
  };

  return {
      header: {
          magic: 0, version: 8, skinWidth: 128, skinHeight: 128,
          frameSize: 0, numSkins: 0, numVertices: 3, numTexCoords: 3,
          numTriangles: 1, numGlCommands: 0, numFrames: 2,
          offsetSkins: 0, offsetTexCoords: 0, offsetTriangles: 0,
          offsetFrames: 0, offsetGlCommands: 0, offsetEnd: 0
      },
      skins: [],
      texCoords: [
          { s: 0, t: 0 },
          { s: 128, t: 0 },
          { s: 64, t: 128 }
      ],
      triangles: [
          { vertexIndices: [0, 2, 1], texCoordIndices: [0, 2, 1] }
      ],
      frames: [frame0, frame1],
      glCommands: [] // Use triangles fallback
  };
}

function createWhiteTexture(device: GPUDevice): Texture2D {
    const texture = new Texture2D(device, {
        width: 1,
        height: 1,
        format: 'rgba8unorm',
        label: 'white-texture'
    });
    texture.upload(new Uint8Array([255, 255, 255, 255]));
    return texture;
}

function createDepthTexture(device: GPUDevice, width: number, height: number): GPUTexture {
    return device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        label: 'depth-texture'
    });
}

describe('MD2 Visual Tests', () => {
    let gpuSetup: HeadlessWebGPUSetup | null = null;

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

    it('md2: static render', async () => {
        if (!gpuSetup) return;
        const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(256, 256);
        const { device, format } = context;

        const model = createMockModel();
        const pipeline = new Md2Pipeline(device, format);
        const mesh = new Md2MeshBuffers(device, model);
        const texture = createWhiteTexture(device);

        // Update mesh for frame 0
        mesh.update(model, { frame0: 0, frame1: 0, lerp: 0 });

        // Setup camera
        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, [0, 0, 50], [0, 0, 0], [0, 1, 0]);

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, viewMatrix);

        const depthTexture = createDepthTexture(device, 256, 256);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: renderTargetView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard'
            }
        });

        pipeline.bind(pass, {
            modelViewProjection: mvp,
            ambientLight: 1.0, // Fully lit
        }, texture, 0.0);

        pipeline.draw(pass, mesh);
        pass.end();

        device.queue.submit([encoder.finish()]);

        const pixels = await captureTexture(device, renderTarget, 256, 256);
        await expectSnapshot(pixels, {
            name: 'md2-static',
            description: 'A simple white triangle rendered from an MD2 model',
            width: 256,
            height: 256,
            snapshotDir,
            updateBaseline
        });

        await cleanup();
        mesh.dispose();
        texture.destroy();
        depthTexture.destroy();
    });

    it('md2: interpolated render', async () => {
        if (!gpuSetup) return;
        const width = 256;
        const height = 256;
        const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(width, height);
        const { device, format } = context;

        const model = createMockModel();
        const pipeline = new Md2Pipeline(device, format);
        const mesh = new Md2MeshBuffers(device, model);
        const texture = createWhiteTexture(device);

        const fps = 10;
        const durationSeconds = 2.0;
        const frameCount = fps * durationSeconds;

        await expectAnimationSnapshot(async (frameIndex) => {
            const time = frameIndex * (1.0 / fps);
            // Cycle lerp 0 -> 1 -> 0
            // Sine wave 0..1
            const lerp = (Math.sin(time * Math.PI) + 1) / 2;

            mesh.update(model, { frame0: 0, frame1: 1, lerp });

            const projection = mat4.create();
            mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
            const viewMatrix = mat4.create();
            mat4.lookAt(viewMatrix, [0, -30, 20], [0, 0, 5], [0, 1, 0]);

            const mvp = mat4.create();
            mat4.multiply(mvp, projection, viewMatrix);

            const depthTexture = createDepthTexture(device, width, height);
            const encoder = device.createCommandEncoder();
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: renderTargetView,
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'store'
                }],
                depthStencilAttachment: {
                    view: depthTexture.createView(),
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'discard'
                }
            });

            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 1.0,
                tint: [0, 1, 0, 1]
            }, texture, lerp);

            pipeline.draw(pass, mesh);
            pass.end();

            device.queue.submit([encoder.finish()]);
            depthTexture.destroy(); // Important in loop

            return captureTexture(device, renderTarget, width, height);
        }, {
            name: 'md2-interpolated',
            description: 'A green tinted triangle interpolated between two frames over time.',
            width,
            height,
            snapshotDir,
            updateBaseline,
            fps,
            frameCount
        });

        await cleanup();
        mesh.dispose();
        texture.destroy();
    });

    it('md2: dynamic light', async () => {
        if (!gpuSetup) return;
        const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(256, 256);
        const { device, format } = context;

        const model = createMockModel();
        const pipeline = new Md2Pipeline(device, format);
        const mesh = new Md2MeshBuffers(device, model);
        const texture = createWhiteTexture(device);

        mesh.update(model, { frame0: 0, frame1: 0, lerp: 0 });

        const projection = mat4.create();
        mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
        const viewMatrix = mat4.create();
        mat4.lookAt(viewMatrix, [0, 0, 50], [0, 0, 0], [0, 1, 0]);

        const mvp = mat4.create();
        mat4.multiply(mvp, projection, viewMatrix);

        const dlights = [{
            origin: { x: 0, y: 0, z: 10 } as any,
            color: { x: 1, y: 0, z: 0 } as any,
            intensity: 50
        }];

        const depthTexture = createDepthTexture(device, 256, 256);
        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: renderTargetView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'discard'
            }
        });

        pipeline.bind(pass, {
            modelViewProjection: mvp,
            ambientLight: 0.1,
            lightDirection: [0, 1, 0],
            dlights: dlights
        }, texture, 0.0);

        pipeline.draw(pass, mesh);
        pass.end();

        device.queue.submit([encoder.finish()]);

        const pixels = await captureTexture(device, renderTarget, 256, 256);
        await expectSnapshot(pixels, {
            name: 'md2-lit',
            description: 'A red lit triangle showing dynamic lighting',
            width: 256,
            height: 256,
            snapshotDir,
            updateBaseline
        });

        await cleanup();
        mesh.dispose();
        texture.destroy();
        depthTexture.destroy();
    });
});
