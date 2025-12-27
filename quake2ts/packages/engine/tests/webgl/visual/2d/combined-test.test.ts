import { test } from 'vitest';
import { chromium } from 'playwright';
import { expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const snapshotDir = path.join(__dirname, '..', '..', '__snapshots__');

test('combined: red background in single evaluate', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 256, height: 256 } });

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0;">
        <canvas id="glCanvas" width="256" height="256"></canvas>
      </body>
    </html>
  `);

  try {
    // Render AND capture in a single page.evaluate()
    const pixelData = await page.evaluate(() => {
      const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2')!;

      // Clear to red
      gl.clearColor(1, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.finish();

      // Capture immediately
      const pixels = new Uint8Array(256 * 256 * 4);
      gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      // Flip vertically
      const flipped = new Uint8Array(pixels.length);
      const rowSize = 256 * 4;
      for (let y = 0; y < 256; y++) {
        const srcRow = (256 - 1 - y) * rowSize;
        const dstRow = y * rowSize;
        for (let x = 0; x < rowSize; x++) {
          flipped[dstRow + x] = pixels[srcRow + x];
        }
      }

      return Array.from(flipped);
    });

    const pixels = new Uint8ClampedArray(pixelData);

    await expectSnapshot(pixels, {
      name: 'combined-red',
      description: 'Red background from combined evaluate',
      width: 256,
      height: 256,
      updateBaseline: process.env.UPDATE_VISUAL === '1',
      snapshotDir
    });
  } finally {
    await browser.close();
  }
}, { timeout: 30000 });
