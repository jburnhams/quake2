import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('Material: Tinting', { timeout: 30000 }, async () => {
  await testWebGLRenderer(`
    // Resize canvas to match test dimensions
    gl.canvas.width = 128;
    gl.canvas.height = 64;
    gl.viewport(0, 0, 128, 64);

    gl.clearColor(0.0, 0.0, 0.0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const tex = new Quake2Engine.Texture2D(gl);
    const data = new Uint8Array([255, 255, 255, 255]); // White
    tex.upload(1, 1, data);

    renderer.begin2D();
    // Draw Red Tint
    renderer.drawPic(10, 10, tex, [1, 0, 0, 1]);
    // Draw Green Tint
    renderer.drawPic(50, 10, tex, [0, 1, 0, 1]);
    // Draw 50% Alpha
    renderer.drawPic(90, 10, tex, [1, 1, 1, 0.5]);
    renderer.end2D();

  `, {
    name: 'material-tinting',
    description: 'Verifies material tinting/modulation using drawPic with color argument',
    width: 128,
    height: 64,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
});
