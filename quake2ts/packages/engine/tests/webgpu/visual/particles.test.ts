import { describe, it, beforeAll, afterAll } from 'vitest';
import { createRenderTestSetup, expectAnimationSnapshot, expectSnapshot, initHeadlessWebGPU, HeadlessWebGPUSetup, captureTexture } from '@quake2ts/test-utils';
import { ParticleRenderer } from '../../../src/render/webgpu/pipelines/particleSystem.js';
import { ParticleSystem, spawnSteam, spawnExplosion, spawnBlood } from '../../../src/render/particleSystem.js';
import { RandomGenerator, createMat4Identity, mat4Ortho } from '@quake2ts/shared';
import { Texture2D } from '../../../src/render/webgpu/resources.js';
import path from 'path';
import fs from 'fs';

const snapshotDir = path.join(__dirname, '__snapshots__');
const updateBaseline = process.env.UPDATE_VISUAL === '1';

describe('Particle System Visual Tests', () => {
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

  it('particles-basic', async () => {
      if (!gpuSetup) return;

      const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(256, 256);
      const { device, format } = context;

      const renderer = new ParticleRenderer(device, format);
      const rng = new RandomGenerator(12345);
      const system = new ParticleSystem(100, rng);

      system.spawn({
          position: { x: -5, y: -5, z: -10 },
          color: [1, 0, 0, 0.5],
          size: 5,
          lifetime: 10,
          blendMode: 'alpha'
      });
      system.spawn({
          position: { x: 5, y: 5, z: -10 },
          color: [0, 1, 0, 0.5],
          size: 5,
          lifetime: 10,
          blendMode: 'additive'
      });
      system.spawn({
          position: { x: 0, y: 0, z: -10 },
          color: [0, 0, 1, 0.5],
          size: 8,
          lifetime: 10,
          blendMode: 'alpha'
      });
      system.spawn({
          position: { x: 2, y: 2, z: -10 },
          color: [1, 1, 0, 0.5],
          size: 8,
          lifetime: 10,
          blendMode: 'additive'
      });

      system.update(0);

      const projection = createMat4Identity();
      mat4Ortho(projection, -10, 10, -10, 10, 0.1, 100);
      const viewRight = { x: 1, y: 0, z: 0 };
      const viewUp = { x: 0, y: 1, z: 0 };

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
          colorAttachments: [{
              view: renderTargetView,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'store'
          }]
      });

      renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
      pass.end();

      device.queue.submit([encoder.finish()]);

      const pixels = await captureTexture(device, renderTarget, 256, 256);
      await expectSnapshot(pixels, {
          name: 'particles-basic',
          description: 'Basic particle rendering showing alpha-blended and additive particles.',
          width: 256,
          height: 256,
          snapshotDir,
          updateBaseline
      });

      await cleanup();
      renderer.dispose();
  });

  it('particles-smoke', async () => {
    if (!gpuSetup) return;

    const width = 256;
    const height = 256;
    const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(width, height);
    const { device, format } = context;

    const renderer = new ParticleRenderer(device, format);

    const fps = 10;
    const durationSeconds = 1.5;
    const frameCount = fps * durationSeconds;

    await expectAnimationSnapshot(async (frameIndex) => {
        const time = frameIndex * (1.0 / fps);

        // Recreate system state deterministically
        const rng = new RandomGenerator(9999);
        const system = new ParticleSystem(100, rng);
        spawnSteam({ system, origin: { x: 0, y: 0, z: -10 } });

        // Update system to current time
        const dt = 1/20;
        let t = 0;
        while(t < time) {
            const step = Math.min(dt, time - t);
            system.update(step);
            t += step;
        }

        const projection = createMat4Identity();
        mat4Ortho(projection, -100, 100, -50, 150, 0.1, 500);
        const viewRight = { x: 1, y: 0, z: 0 };
        const viewUp = { x: 0, y: 1, z: 0 };

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: renderTargetView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store'
            }]
        });

        renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
        pass.end();

        device.queue.submit([encoder.finish()]);
        return captureTexture(device, renderTarget, width, height);

    }, {
        name: 'particles-smoke',
        description: 'Smoke/Steam particles rising and fading over time.',
        width,
        height,
        snapshotDir,
        updateBaseline,
        fps,
        frameCount
    });

    await cleanup();
    renderer.dispose();
  });

  it('particles-explosion', async () => {
    if (!gpuSetup) return;

    const width = 256;
    const height = 256;
    const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(width, height);
    const { device, format } = context;

    const renderer = new ParticleRenderer(device, format);

    const fps = 10;
    const durationSeconds = 1.0;
    const frameCount = fps * durationSeconds;

    await expectAnimationSnapshot(async (frameIndex) => {
        const time = frameIndex * (1.0 / fps);
        const rng = new RandomGenerator(8888);
        const system = new ParticleSystem(200, rng);
        spawnExplosion({ system, origin: { x: 0, y: 0, z: -20 } });

        const dt = 1/20;
        let t = 0;
        while(t < time) {
            const step = Math.min(dt, time - t);
            system.update(step);
            t += step;
        }

        const projection = createMat4Identity();
        mat4Ortho(projection, -20, 20, -20, 20, 0.1, 100);
        const viewRight = { x: 1, y: 0, z: 0 };
        const viewUp = { x: 0, y: 1, z: 0 };

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: renderTargetView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store'
            }]
        });

        renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
        pass.end();

        device.queue.submit([encoder.finish()]);
        return captureTexture(device, renderTarget, width, height);
    }, {
        name: 'particles-explosion',
        description: 'Explosion particles expanding outwards.',
        width,
        height,
        snapshotDir,
        updateBaseline,
        fps,
        frameCount
    });

    await cleanup();
    renderer.dispose();
  });

  it('particles-blood', async () => {
    if (!gpuSetup) return;

    const width = 256;
    const height = 256;
    const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(width, height);
    const { device, format } = context;

    const renderer = new ParticleRenderer(device, format);

    const fps = 10;
    const durationSeconds = 0.8;
    const frameCount = fps * durationSeconds;

    await expectAnimationSnapshot(async (frameIndex) => {
        const time = frameIndex * (1.0 / fps);
        const rng = new RandomGenerator(7777);
        const system = new ParticleSystem(100, rng);
        spawnBlood({ system, origin: { x: 0, y: 0, z: -10 }, direction: { x: 0, y: 1, z: 0 } });

        const dt = 1/20;
        let t = 0;
        while(t < time) {
            const step = Math.min(dt, time - t);
            system.update(step);
            t += step;
        }

        const projection = createMat4Identity();
        // Use a larger viewport to capture the directional spray of blood particles
        mat4Ortho(projection, -100, 100, -50, 150, 0.1, 500);
        const viewRight = { x: 1, y: 0, z: 0 };
        const viewUp = { x: 0, y: 1, z: 0 };

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: renderTargetView,
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store'
            }]
        });

        renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
        pass.end();

        device.queue.submit([encoder.finish()]);
        return captureTexture(device, renderTarget, width, height);
    }, {
        name: 'particles-blood',
        description: 'Blood particles spraying directionally.',
        width,
        height,
        snapshotDir,
        updateBaseline,
        fps,
        frameCount
    });

    await cleanup();
    renderer.dispose();
  });

  it('particles-many-performance', async () => {
      if (!gpuSetup) return;

      const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(256, 256);
      const { device, format } = context;

      const renderer = new ParticleRenderer(device, format);
      const rng = new RandomGenerator(1111);
      const count = 5000;
      const system = new ParticleSystem(count, rng);

      const grid = Math.ceil(Math.sqrt(count));
      for(let i=0; i<count; i++) {
           const x = (i % grid) - grid/2;
           const y = (Math.floor(i / grid)) - grid/2;
           system.spawn({
              position: { x: x * 1.2, y: y * 1.2, z: -10 },
              color: [rng.frandom(), rng.frandom(), rng.frandom(), 0.5],
              size: 2,
              lifetime: 100,
              blendMode: 'additive'
           });
      }

      system.update(0);

      const projection = createMat4Identity();
      mat4Ortho(projection, -50, 50, -50, 50, 0.1, 100);
      const viewRight = { x: 1, y: 0, z: 0 };
      const viewUp = { x: 0, y: 1, z: 0 };

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
          colorAttachments: [{
              view: renderTargetView,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'store'
          }]
      });

      renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
      pass.end();

      device.queue.submit([encoder.finish()]);

      const pixels = await captureTexture(device, renderTarget, 256, 256);
      await expectSnapshot(pixels, {
          name: 'particles-many',
          description: 'Performance test rendering 5000 particles.',
          width: 256,
          height: 256,
          snapshotDir,
          updateBaseline
      });

      await cleanup();
      renderer.dispose();
  });

  it('particles-textured', async () => {
      if (!gpuSetup) return;

      const { context, renderTarget, renderTargetView, cleanup } = await createRenderTestSetup(256, 256);
      const { device, format } = context;

      const renderer = new ParticleRenderer(device, format);
      const rng = new RandomGenerator(67890);
      const system = new ParticleSystem(100, rng);

      const size = 32;
      const data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
              const i = (y * size + x) * 4;
              const check = ((Math.floor(x / 4) + Math.floor(y / 4)) % 2) === 0;
              data[i] = check ? 255 : 0;
              data[i + 1] = check ? 255 : 0;
              data[i + 2] = check ? 255 : 0;
              data[i + 3] = 255;
          }
      }

      const texture = new Texture2D(device, {
          width: size,
          height: size,
          format: 'rgba8unorm'
      });
      texture.upload(data);

      const textures = new Map<number, Texture2D>();
      textures.set(1, texture);

      system.spawn({
          position: { x: -3, y: 0, z: -10 },
          color: [1, 0, 0, 1],
          size: 6,
          lifetime: 10,
          textureIndex: 0
      });

      system.spawn({
          position: { x: 3, y: 0, z: -10 },
          color: [0, 1, 0, 1],
          size: 6,
          lifetime: 10,
          textureIndex: 1
      });

      system.update(0);

      const projection = createMat4Identity();
      mat4Ortho(projection, -10, 10, -10, 10, 0.1, 100);
      const viewRight = { x: 1, y: 0, z: 0 };
      const viewUp = { x: 0, y: 1, z: 0 };

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
          colorAttachments: [{
              view: renderTargetView,
              loadOp: 'clear',
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: 'store'
          }]
      });

      renderer.render(pass, projection as Float32Array, viewRight, viewUp, system, textures);
      pass.end();

      device.queue.submit([encoder.finish()]);

      const pixels = await captureTexture(device, renderTarget, 256, 256);
      await expectSnapshot(pixels, {
          name: 'particles-textured',
          description: 'Particles with custom textures. Left: Default soft circle (Red). Right: Checkerboard texture (Green).',
          width: 256,
          height: 256,
          snapshotDir,
          updateBaseline
      });

      await cleanup();
      renderer.dispose();
      texture.destroy();
  });
});
