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
    // We map Quake directions to Cubemap faces so that:
    // Quake Front (+X) -> GL Back (-Z) -> Face 5
    // Quake Back (-X) -> GL Front (+Z) -> Face 4
    // Quake Left (+Y) -> GL Left (-X) -> Face 1
    // Quake Right (-Y) -> GL Right (+X) -> Face 0
    // Quake Up (+Z) -> GL Top (+Y) -> Face 2
    // Quake Down (-Z) -> GL Bottom (-Y) -> Face 3

    // Colors:
    // Front (+X) = Red
    // Back (-X) = Cyan
    // Left (+Y) = Green
    // Right (-Y) = Magenta
    // Up (+Z) = Blue
    // Down (-Z) = Yellow

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

    const createCheckerboardData = (r1: number, g1: number, b1: number, r2: number, g2: number, b2: number, squareSize: number = 8) => {
        const data = new Uint8Array(size * size * 4);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = y * size + x;
                const isEvenSquare = (Math.floor(x / squareSize) + Math.floor(y / squareSize)) % 2 === 0;
                data[i * 4] = isEvenSquare ? r1 : r2;
                data[i * 4 + 1] = isEvenSquare ? g1 : g2;
                data[i * 4 + 2] = isEvenSquare ? b1 : b2;
                data[i * 4 + 3] = 255;
            }
        }
        return data;
    };

    // Cubemap faces mapped via Quake→GL transform in shader:
    // cubemapDir.x=-dir.y, cubemapDir.y=dir.z, cubemapDir.z=-dir.x
    // Face 0 (+X in GL): Quake -Y (right) -> Magenta
    cubemap.uploadFace(0, createColorData(255, 0, 255));
    // Face 1 (-X in GL): Quake +Y (left) -> Green
    cubemap.uploadFace(1, createColorData(0, 255, 0));
    // Face 2 (+Y in GL): Quake +Z (up) -> Blue
    cubemap.uploadFace(2, createColorData(0, 0, 255));
    // Face 3 (-Y in GL): Quake -Z (down) -> Yellow
    cubemap.uploadFace(3, createColorData(255, 255, 0));
    // Face 4 (+Z in GL): Quake -X (back) -> Cyan
    cubemap.uploadFace(4, createColorData(0, 255, 255));
    // Face 5 (-Z in GL): Quake +X (forward) -> Red/Dark-Red Checkerboard (for scrolling visibility)
    cubemap.uploadFace(5, createCheckerboardData(255, 0, 0, 128, 0, 0, 8));
  });

  afterAll(lifecycle.cleanup);

  it('renders skybox front face', async () => {
    const camera = new Camera();
    camera.setFov(90);
    camera.setAspectRatio(1.0);

    // Look Forward (+X) -> Should see GL Back (-Z) -> Red
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
      // Quake Z is Up. Should see GL Top (+Y) -> Blue
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
          description: 'Blue skybox face (+Z) visible when looking up.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  // Explicitly unrolled test cases for gallery visibility
  it('renders look_forward', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([10, 0, 0]); // Forward (+X)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_forward',
          description: 'Forward (+X). Expected: Red (Front)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_back', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([-10, 0, 0]); // Back (-X)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_back',
          description: 'Back (-X). Expected: Cyan (Back)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_left', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([0, 10, 0]); // Left (+Y)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_left',
          description: 'Left (+Y). Expected: Green (Left)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_right', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([0, -10, 0]); // Right (-Y)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_right',
          description: 'Right (-Y). Expected: Magenta (Right)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_up', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([0, 0, 10]); // Up (+Z)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_up',
          description: 'Up (+Z). Expected: Blue (Top)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_down', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([0, 0, -10]); // Down (-Z)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_down',
          description: 'Down (-Z). Expected: Yellow (Bottom)',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_fwd_left', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([10, 10, 0]); // Forward-Left (+X +Y)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_fwd_left',
          description: 'Forward-Left (+X +Y). Expected: Red/Green Vertical Split',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_fwd_up', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([10, 0, 10]); // Forward-Up (+X +Z)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_fwd_up',
          description: 'Forward-Up (+X +Z). Expected: Red/Blue Horizontal Split',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir
      });
  });

  it('renders look_corner', async () => {
      const camera = new Camera();
      camera.setFov(90);
      camera.setAspectRatio(1.0);
      camera.setPosition(0, 0, 0);
      camera.lookAt([10, 10, 10]); // Corner (+X +Y +Z)

      renderer.renderFrame({ camera, sky: { cubemap } });
      const frameRenderer = (renderer as any).frameRenderer;
      const pixels = await captureTexture(renderer.device, frameRenderer.headlessTarget, 256, 256);

      await expectSnapshot(pixels, {
          name: 'look_corner',
          description: 'Corner (+X +Y +Z). Expected: Red/Green/Blue Intersection',
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
      // Look forward-up (+X +Z) to see both the red checkerboard (front) and blue (top) faces
      camera.lookAt([10, 0, 10]);

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
          description: 'Skybox with scrolling red/dark-red checkerboard (front) and blue (top) faces visible. Texture scrolls over time.',
          width: 256,
          height: 256,
          updateBaseline,
          snapshotDir,
          frameCount,
          fps
      });
  });
});
