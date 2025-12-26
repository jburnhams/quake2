import { test } from '../../helpers/visual-testing.js';
import { ParticleRenderer } from '../../../src/render/webgpu/pipelines/particleSystem.js';
import { ParticleSystem } from '../../../src/render/particleSystem.js';
import { RandomGenerator, createMat4Identity, mat4Ortho } from '@quake2ts/shared';

test('pipeline: particles-basic', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      // Setup
      const renderer = new ParticleRenderer(device, format);
      const rng = new RandomGenerator(12345);
      const system = new ParticleSystem(100, rng);

      // Spawn a few particles
      system.spawn({
        position: { x: -5, y: -5, z: -10 },
        color: [1, 0, 0, 0.5], // Red, Alpha 0.5
        size: 5,
        lifetime: 10,
        blendMode: 'alpha'
      });

      system.spawn({
        position: { x: 5, y: 5, z: -10 },
        color: [0, 1, 0, 0.5], // Green, Alpha 0.5
        size: 5,
        lifetime: 10,
        blendMode: 'additive'
      });

      // Overlapping particles to test blending
      system.spawn({
          position: { x: 0, y: 0, z: -10 },
          color: [0, 0, 1, 0.5], // Blue
          size: 8,
          lifetime: 10,
          blendMode: 'alpha'
      });
      system.spawn({
          position: { x: 2, y: 2, z: -10 },
          color: [1, 1, 0, 0.5], // Yellow
          size: 8,
          lifetime: 10,
          blendMode: 'additive'
      });

      // Update system to process 0 time (just to ensure state is ready)
      system.update(0);

      // Prepare View
      const projection = createMat4Identity();
      mat4Ortho(projection, -10, 10, -10, 10, 0.1, 100);

      const viewRight = { x: 1, y: 0, z: 0 };
      const viewUp = { x: 0, y: 1, z: 0 };

      // We return a callback that uses the RenderPassEncoder
      return (pass) => {
          renderer.render(pass, projection as Float32Array, viewRight, viewUp, system);
      };
    },
    {
      name: 'particles-basic',
      description: 'Basic particle rendering showing alpha-blended and additive particles of different colors (Red, Green, Blue, Yellow) and sizes.'
    }
  );
});
