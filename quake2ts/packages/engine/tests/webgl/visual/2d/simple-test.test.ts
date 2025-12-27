import { test } from 'vitest';
import {
  createWebGLPlaywrightSetup,
  expectWebGLPlaywrightSnapshot,
} from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('simple: red background', async () => {
  const setup = await createWebGLPlaywrightSetup({ width: 256, height: 256 });

  try {
    await expectWebGLPlaywrightSnapshot(
      setup,
      async (page) => {
        await page.evaluate(() => {
          const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
          const gl = canvas.getContext('webgl2')!;

          // Just clear to red
          gl.clearColor(1, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.finish();
        });
      },
      {
        name: 'simple-red',
        description: 'Simple red background',
        updateBaseline: process.env.UPDATE_VISUAL === '1',
        snapshotDir
      }
    );
  } finally {
    await setup.cleanup();
  }
}, { timeout: 30000 });
