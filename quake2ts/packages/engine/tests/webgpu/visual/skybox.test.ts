import { describe, it, expect, beforeAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import { Camera } from '../../../src/render/camera.js';
import { initHeadlessWebGPU, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('Skybox Pipeline', () => {
  let renderer: WebGPURenderer;
  let cubemap: TextureCubeMap;

  beforeAll(async () => {
    await initHeadlessWebGPU();
    renderer = await createWebGPURenderer(undefined, {
       width: 256,
       height: 256
    }) as WebGPURenderer;

    // Create a simple colored cubemap
    // +X (Right): Red
    // -X (Left): Cyan
    // +Y (Top): Green
    // -Y (Bottom): Magenta
    // +Z (Front): Blue
    // -Z (Back): Yellow
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

    cubemap.uploadFace(0, createColorData(255, 0, 0));     // +X Right (Red)
    cubemap.uploadFace(1, createColorData(0, 255, 255));   // -X Left (Cyan)
    cubemap.uploadFace(2, createColorData(0, 255, 0));     // +Y Top (Green)
    cubemap.uploadFace(3, createColorData(255, 0, 255));   // -Y Bottom (Magenta)
    cubemap.uploadFace(4, createColorData(0, 0, 255));     // +Z Front (Blue)
    cubemap.uploadFace(5, createColorData(255, 255, 0));   // -Z Back (Yellow)
  });

  it('renders skybox front face', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);

    // Look Forward (+X) -> Should see Right face of cubemap (+X)?
    // Wait, "Right" in cubemap terminology means +X.
    // Quake X is Forward.
    // So looking Forward in Quake (+X) should map to +X face of cubemap (Right).
    // So we expect Red.
    camera.setPosition(0, 0, 0);
    camera.setRotation(0, 0, 0);

    renderer.renderFrame({
        camera,
        sky: {
            cubemap
        }
    });

    const frameRenderer = (renderer as any).frameRenderer;
    const pixels = await captureTexture(
        renderer.device,
        frameRenderer.headlessTarget,
        256,
        256
    );

    await expectSnapshot(pixels, {
        name: 'skybox_front',
        description: 'Red skybox face (+X) visible when looking forward.',
        width: 256,
        height: 256,
        updateBaseline,
        snapshotDir
    });
  });

  it('renders skybox top face', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);

      // Look Up: Pitch -90
      // Quake Z is Up.
      // So looking Up should see +Y (Top) face of cubemap?
      // Wait, Quake Z (Up) -> WebGL Y (Up).
      // Cubemap +Y is Top.
      // So we expect Green.
      camera.setPosition(0, 0, 0);
      camera.setRotation(-90, 0, 0);

      renderer.renderFrame({
          camera,
          sky: {
              cubemap
          }
      });

      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(
          renderer.device,
          frameRenderer.headlessTarget,
          256,
          256
      );

      await expectSnapshot(pixels, {
          name: 'skybox_top',
        description: 'Green skybox face (+Y) visible when looking up.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders skybox corner', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);

      // Look at a corner
      // We look at vector (10, 10, 10) which corresponds to Forward, Left, Up
      // This should center the view on the corner where three faces meet
      camera.setPosition(0, 0, 0);
      camera.lookAt([10, 10, 10]);

      renderer.renderFrame({
          camera,
          sky: {
              cubemap
          }
      });

      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(
          renderer.device,
          frameRenderer.headlessTarget,
          256,
          256
      );

      await expectSnapshot(pixels, {
          name: 'skybox_corner',
          description: 'Corner view of the skybox showing intersection of three faces.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders skybox with scrolling', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.setRotation(0, 0, 0);

      renderer.renderFrame({
          camera,
          sky: {
              cubemap,
              scrollSpeeds: [0.1, 0.1]
          },
          timeSeconds: 10.0
      });

      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(
          renderer.device,
          frameRenderer.headlessTarget,
          256,
          256
      );

      await expectSnapshot(pixels, {
          name: 'skybox_scrolling',
        description: 'Skybox with scrolling texture offset applied, showing partial texture wrap.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });
});
