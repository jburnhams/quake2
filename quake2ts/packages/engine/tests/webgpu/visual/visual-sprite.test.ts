import { test } from '@quake2ts/test-utils'; // visual-testing';
import { SpriteRenderer } from '../../../src/render/webgpu/pipelines/sprite';
import { Texture2D } from '../../../src/render/webgpu/resources';

test('sprite: solid red rectangle', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.setProjection(256, 256);

      renderer.begin(encoder, view);
      renderer.drawSolidRect(64, 64, 128, 128, [1, 0, 0, 1]);
      renderer.end();
    },
    { name: 'sprite-red-rect', description: 'A solid red rectangle centered on a black background.' }
  );
});

test('sprite: textured quad', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.setProjection(256, 256);

      // Create a 2x2 texture (Checkerboard)
      const texture = new Texture2D(device, {
        width: 2,
        height: 2,
        format: 'rgba8unorm',
        label: 'checker-texture'
      });

      const data = new Uint8Array([
        255, 255, 255, 255,   0, 0, 0, 255,
        0, 0, 0, 255,         255, 255, 255, 255
      ]);
      texture.upload(data);

      renderer.begin(encoder, view);
      // Draw scaled up to 128x128
      renderer.drawTexturedQuad(64, 64, 128, 128, texture);
      renderer.end();
    },
    { name: 'sprite-textured', description: 'A black and white checkerboard texture scaled to 128x128 in the center.' }
  );
});

test('sprite: batched quads', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.setProjection(256, 256);

      renderer.begin(encoder, view);

      // Draw 4 rectangles in corners
      // Top-Left: Red
      renderer.drawSolidRect(10, 10, 50, 50, [1, 0, 0, 1]);

      // Top-Right: Green
      renderer.drawSolidRect(196, 10, 50, 50, [0, 1, 0, 1]);

      // Bottom-Left: Blue
      renderer.drawSolidRect(10, 196, 50, 50, [0, 0, 1, 1]);

      // Bottom-Right: White
      renderer.drawSolidRect(196, 196, 50, 50, [1, 1, 1, 1]);

      renderer.end();
    },
    { name: 'sprite-batched', description: 'Four small colored squares (Red, Green, Blue, White) positioned in the corners.' }
  );
});

test('sprite: alpha blending', async ({ renderAndExpectSnapshot }) => {
  await renderAndExpectSnapshot(
    async (device, format, encoder, view) => {
      const renderer = new SpriteRenderer(device, format);
      renderer.setProjection(256, 256);

      renderer.begin(encoder, view);

      // Background: Solid Blue
      renderer.drawSolidRect(50, 50, 156, 156, [0, 0, 1, 1]);

      // Foreground: Semi-transparent Red (50%)
      // Should result in Purple-ish
      renderer.drawSolidRect(100, 100, 56, 56, [1, 0, 0, 0.5]);

      renderer.end();
    },
    { name: 'sprite-alpha', description: 'A semi-transparent red square overlaid on a solid blue square, demonstrating alpha blending.' }
  );
});
