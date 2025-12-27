import { test } from 'vitest';
import { testWebGLRenderer } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('example: blue rectangle using actual renderer', async () => {
  await testWebGLRenderer(`
    // Clear background to black
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use the actual quake2ts renderer API
    renderer.begin2D();
    renderer.drawfillRect(64, 64, 128, 128, [0, 0, 1, 1]);
    renderer.end2D();
  `, {
    name: 'example-blue-rect',
    description: 'Blue rectangle rendered with quake2ts renderer',
    width: 256,
    height: 256,
    updateBaseline: process.env.UPDATE_VISUAL === '1',
    snapshotDir
  });
}, { timeout: 30000 });
