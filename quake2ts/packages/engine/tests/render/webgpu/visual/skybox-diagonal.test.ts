import { describe, it, beforeAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../../src/render/webgpu/renderer.js';
import { TextureCubeMap } from '../../../../src/render/webgpu/resources.js';
import { Camera } from '../../../../src/render/camera.js';
import { initHeadlessWebGPU, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, 'baselines');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('Skybox Diagonal Views (Visual)', () => {
  let renderer: WebGPURenderer;
  let cubemap: TextureCubeMap;

  beforeAll(async () => {
    await initHeadlessWebGPU();
    renderer = await createWebGPURenderer(undefined, {
       width: 256,
       height: 256
    }) as WebGPURenderer;

    // Create colored cubemap
    const size = 64;
    cubemap = new TextureCubeMap(renderer.device, {
        size,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });

    const createColorData = (r: number, g: number, b: number) => {
        const data = new Uint8Array(size * size * 4);
        for (let i = 0; i < size * size; i++) {
            data[i * 4] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = 255;
        }
        return data;
    };

    // Upload distinct colors
    cubemap.uploadFace(0, createColorData(255, 0, 0));   // Face 0
    cubemap.uploadFace(1, createColorData(0, 255, 0));   // Face 1
    cubemap.uploadFace(2, createColorData(0, 0, 255));   // Face 2
    cubemap.uploadFace(3, createColorData(255, 255, 0)); // Face 3
    cubemap.uploadFace(4, createColorData(0, 255, 255)); // Face 4
    cubemap.uploadFace(5, createColorData(255, 0, 255)); // Face 5
  });

  it('renders correctly at 45/45 angle', async () => {
    const camera = new Camera(256, 256);
    camera.setPosition(0, 0, 50);
    camera.setRotation(45, 45, 0);

    renderer.renderFrame({
        camera,
        cameraState: camera.toState(),
        sky: { cubemap }
    });

    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(
        renderer.device,
        frameRenderer.headlessTarget,
        256,
        256
    );

    await expectSnapshot(pixels, {
        name: 'skybox-diagonal-45-45',
        description: 'Skybox at 45/45 degrees',
        width: 256,
        height: 256,
        updateBaseline,
        snapshotDir
    });
  });
});
