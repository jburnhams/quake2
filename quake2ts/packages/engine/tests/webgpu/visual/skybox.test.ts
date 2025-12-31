import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { TextureCubeMap } from '../../../src/render/webgpu/resources.js';
import { Camera } from '../../../src/render/camera.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot, expectAnimationSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('Skybox Pipeline', () => {
  const lifecycle = createWebGPULifecycle();
  let renderer: WebGPURenderer;
  let cubemap: TextureCubeMap;

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    renderer = await createWebGPURenderer(undefined, {
       width: 256,
       height: 256
    }) as WebGPURenderer;
    lifecycle.trackRenderer(renderer);

    // Create a simple colored cubemap
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

    // Colors:
    // Front (+X) = Red
    // Back (-X) = Cyan
    // Left (+Y) = Green
    // Right (-Y) = Magenta
    // Up (+Z) = Blue
    // Down (-Z) = Yellow

    // Mapping:
    // Face 0 (+X): Quake -Y (Right) -> Magenta
    cubemap.uploadFace(0, createColorData(255, 0, 255));
    // Face 1 (-X): Quake +Y (Left) -> Green
    cubemap.uploadFace(1, createColorData(0, 255, 0));
    // Face 2 (+Y): Quake +Z (Up) -> Blue
    cubemap.uploadFace(2, createColorData(0, 0, 255));
    // Face 3 (-Y): Quake -Z (Down) -> Yellow
    cubemap.uploadFace(3, createColorData(255, 255, 0));
    // Face 4 (+Z): Quake -X (Back) -> Cyan
    cubemap.uploadFace(4, createColorData(0, 255, 255));
    // Face 5 (-Z): Quake +X (Forward) -> Red
    cubemap.uploadFace(5, createColorData(255, 0, 0));
  });

  afterAll(lifecycle.cleanup);

  it('renders skybox front face', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);
    camera.setPosition(0, 0, 0);
    camera.lookAt([10, 0, 0]); // Look Forward (+X)

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
      camera.setPosition(0, 0, 0);
      camera.lookAt([0, 0, 10]); // Look Up (+Z)

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
          description: 'Blue skybox face (+Z) visible when looking up.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders diagonal view (45, 45, 0)', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      // Rotation: Pitch 45 (Up), Yaw 45 (Left).
      // Quake Yaw +45 is Left-Forward (+X +Y).
      // Quake Pitch +45 is Up (+Z).
      // So looking at (+X, +Y, +Z). Should see intersection of Red, Green, Blue.
      camera.setRotation(45, 45, 0);

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
          name: 'skybox_diagonal',
          description: 'Diagonal view (45, 45, 0). Expected: Intersection of faces.',
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

      // Animation parameters
      const fps = 10;
      const durationSeconds = 2.0;
      const frameCount = fps * durationSeconds;

      await expectAnimationSnapshot(async (frameIndex) => {
          const time = frameIndex * (1.0 / fps);

          renderer.renderFrame({
              camera,
              sky: {
                  cubemap,
                  scrollSpeeds: [0.1, 0.1]
              },
              timeSeconds: time
          });

          const frameRenderer = (renderer as any).frameRenderer;
          return captureTexture(
              renderer.device,
              frameRenderer.headlessTarget,
              256,
              256
          );
      }, {
          name: 'skybox_scrolling',
          description: 'Skybox with scrolling texture offset applied over time.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir,
          frameCount,
          fps
      });
  });
});
