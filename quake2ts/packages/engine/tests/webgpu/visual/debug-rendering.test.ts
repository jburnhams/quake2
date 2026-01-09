import { describe, it, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { setupHeadlessWebGPUEnv, createWebGPULifecycle, captureTexture, expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Debug Rendering', () => {
  const lifecycle = createWebGPULifecycle();
  let renderer: Awaited<ReturnType<typeof createWebGPURenderer>>;
  let camera: Camera;

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    lifecycle.device = await navigator.gpu!.requestAdapter().then(adapter => adapter!.requestDevice());
    renderer = await createWebGPURenderer(undefined, {
      headless: true,
      width: 512,
      height: 512,
      device: lifecycle.device
    });

    // Setup camera looking at origin from a distance
    camera = new Camera();
    camera.position = [5, 5, 5];
    camera.rotation = [0, 0, 0];
    camera.lookAt([0, 0, 0]);
    camera.updateMatrices(512, 512);
  });

  afterAll(() => {
    if (renderer) {
      renderer.dispose();
    }
    lifecycle.cleanup();
  });

  it('renders simple lines', async () => {
    renderer.debug.clear();

    // Draw X, Y, Z axes
    renderer.debug.drawAxes({ x: 0, y: 0, z: 0 }, 2.0);

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-axes',
      description: 'Three colored axes (red X, green Y, blue Z) from origin',
      snapshotDir
    });
  });

  it('renders bounding boxes', async () => {
    renderer.debug.clear();

    // Draw several bounding boxes
    renderer.debug.drawBoundingBox(
      { x: -1, y: -1, z: -1 },
      { x: 1, y: 1, z: 1 },
      { r: 1, g: 0, b: 0 }
    );

    renderer.debug.drawBoundingBox(
      { x: -2, y: -0.5, z: -0.5 },
      { x: -1, y: 0.5, z: 0.5 },
      { r: 0, g: 1, b: 0 }
    );

    renderer.debug.drawBoundingBox(
      { x: 1, y: -0.5, z: -0.5 },
      { x: 2, y: 0.5, z: 0.5 },
      { r: 0, g: 0, b: 1 }
    );

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-bounds',
      description: 'Three colored bounding boxes (red center, green left, blue right)',
      snapshotDir
    });
  });

  it('renders point markers', async () => {
    renderer.debug.clear();

    // Draw points at various locations
    renderer.debug.drawPoint({ x: 0, y: 0, z: 0 }, 0.3, { r: 1, g: 1, b: 0 });
    renderer.debug.drawPoint({ x: 1, y: 0, z: 0 }, 0.2, { r: 1, g: 0, b: 1 });
    renderer.debug.drawPoint({ x: 0, y: 1, z: 0 }, 0.2, { r: 0, g: 1, b: 1 });
    renderer.debug.drawPoint({ x: 0, y: 0, z: 1 }, 0.2, { r: 1, g: 0.5, b: 0 });

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-points',
      description: 'Colored point markers at different positions',
      snapshotDir
    });
  });

  it('renders cones', async () => {
    renderer.debug.clear();

    // Draw cones
    renderer.debug.addCone(
      { x: 0, y: 0, z: 1 }, // apex
      { x: 0, y: 0, z: 0 }, // base
      0.5, // radius
      { r: 1, g: 0.5, b: 0 }
    );

    renderer.debug.addCone(
      { x: 1.5, y: 0, z: 0.5 }, // apex
      { x: 1.5, y: 0, z: 0 }, // base
      0.3, // radius
      { r: 0.5, g: 1, b: 0 }
    );

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-cones',
      description: 'Solid cones with lighting',
      snapshotDir
    });
  });

  it('renders torus', async () => {
    renderer.debug.clear();

    // Draw a torus
    renderer.debug.addTorus(
      { x: 0, y: 0, z: 0 }, // center
      1.0, // major radius
      0.3, // minor radius
      { r: 0.8, g: 0.2, b: 0.8 }
    );

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-torus',
      description: 'Purple torus with lighting',
      snapshotDir
    });
  });

  it('renders combined debug primitives', async () => {
    renderer.debug.clear();

    // Draw a complex debug scene
    // Coordinate axes
    renderer.debug.drawAxes({ x: 0, y: 0, z: 0 }, 1.5);

    // Bounding box
    renderer.debug.drawBoundingBox(
      { x: -1, y: -1, z: 0 },
      { x: 1, y: 1, z: 0.5 },
      { r: 1, g: 1, b: 0 }
    );

    // Points
    renderer.debug.drawPoint({ x: -1, y: -1, z: 0 }, 0.15, { r: 1, g: 0, b: 0 });
    renderer.debug.drawPoint({ x: 1, y: -1, z: 0 }, 0.15, { r: 0, g: 1, b: 0 });
    renderer.debug.drawPoint({ x: 1, y: 1, z: 0 }, 0.15, { r: 0, g: 0, b: 1 });
    renderer.debug.drawPoint({ x: -1, y: 1, z: 0 }, 0.15, { r: 1, g: 1, b: 1 });

    // Lines connecting points
    renderer.debug.drawLine(
      { x: -1, y: -1, z: 0.5 },
      { x: 1, y: 1, z: 0.5 },
      { r: 0.5, g: 0.5, b: 1 }
    );

    // Small cone at center
    renderer.debug.addCone(
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: 0.5 },
      0.2,
      { r: 1, g: 0.7, b: 0.3 }
    );

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.05, 0.05, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-combined',
      description: 'Complex scene with multiple debug primitives',
      snapshotDir
    });
  });

  it('renders normals visualization', async () => {
    renderer.debug.clear();

    // Simulate normal visualization on a cube
    const cubeVertices = [
      // Front face
      { pos: { x: -0.5, y: -0.5, z: 0.5 }, normal: { x: 0, y: 0, z: 1 } },
      { pos: { x: 0.5, y: -0.5, z: 0.5 }, normal: { x: 0, y: 0, z: 1 } },
      { pos: { x: 0.5, y: 0.5, z: 0.5 }, normal: { x: 0, y: 0, z: 1 } },
      { pos: { x: -0.5, y: 0.5, z: 0.5 }, normal: { x: 0, y: 0, z: 1 } },
      // Right face
      { pos: { x: 0.5, y: -0.5, z: 0.5 }, normal: { x: 1, y: 0, z: 0 } },
      { pos: { x: 0.5, y: -0.5, z: -0.5 }, normal: { x: 1, y: 0, z: 0 } },
      { pos: { x: 0.5, y: 0.5, z: -0.5 }, normal: { x: 1, y: 0, z: 0 } },
      { pos: { x: 0.5, y: 0.5, z: 0.5 }, normal: { x: 1, y: 0, z: 0 } },
    ];

    // Draw normals as lines
    for (const vertex of cubeVertices) {
      const end = {
        x: vertex.pos.x + vertex.normal.x * 0.3,
        y: vertex.pos.y + vertex.normal.y * 0.3,
        z: vertex.pos.z + vertex.normal.z * 0.3
      };
      renderer.debug.drawLine(vertex.pos, end, { r: 1, g: 1, b: 0 });
    }

    // Draw the cube edges for reference
    renderer.debug.drawBoundingBox(
      { x: -0.5, y: -0.5, z: -0.5 },
      { x: 0.5, y: 0.5, z: 0.5 },
      { r: 0.3, g: 0.3, b: 0.3 }
    );

    // Render frame
    renderer.renderFrame({
      camera,
      clearColor: [0.1, 0.1, 0.1, 1.0]
    });

    const texture = (renderer as any).frameRenderer.headlessTarget;
    const pixels = await captureTexture(lifecycle.device!, texture, 512, 512);

    await expectSnapshot({
      pixels,
      width: 512,
      height: 512,
      name: 'debug-normals',
      description: 'Cube with normal vectors visualized as yellow lines',
      snapshotDir
    });
  });
});
