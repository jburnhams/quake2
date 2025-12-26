import { Page } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { Canvas } from '@napi-rs/canvas';
import fs from 'fs/promises';
import path from 'path';

export interface VisualDiff {
  diffPixels: number;
  diffPercentage: number;
  isMatch: boolean;
  diffImage?: Buffer;
}

export interface VisualScenario {
  sceneName: string;
  setup?: (page: Page) => Promise<void>;
}

/**
 * Captures a screenshot of the game canvas.
 */
export async function captureGameScreenshot(page: Page, name: string): Promise<Buffer> {
  const canvasElement = page.locator('canvas');
  if (await canvasElement.count() > 0) {
    return await canvasElement.screenshot({ path: `${name}.png` });
  }
  return await page.screenshot({ path: `${name}.png` });
}

/**
 * Saves a canvas to a PNG file.
 */
export async function takeScreenshot(canvas: Canvas | HTMLCanvasElement, filepath: string): Promise<void> {
  let buffer: Buffer;

  // Handle @napi-rs/canvas Canvas object
  if ('toBuffer' in canvas && typeof canvas.toBuffer === 'function') {
    buffer = canvas.toBuffer('image/png');
  }
  // Handle JSDOM HTMLCanvasElement
  else if ('toDataURL' in canvas) {
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    buffer = Buffer.from(base64, 'base64');
  } else {
    throw new Error('Unsupported canvas type for screenshot');
  }

  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, buffer);
}

/**
 * Compares two image buffers using pixelmatch.
 */
export function compareScreenshots(baseline: Buffer, current: Buffer, threshold: number = 0.01): VisualDiff {
  try {
    const img1 = PNG.sync.read(baseline);
    const img2 = PNG.sync.read(current);

    if (img1.width !== img2.width || img1.height !== img2.height) {
      throw new Error(`Image dimensions do not match: ${img1.width}x${img1.height} vs ${img2.width}x${img2.height}`);
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const diffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold }
    );

    const diffPercentage = diffPixels / (width * height);
    const isMatch = diffPixels === 0;

    return {
      diffPixels,
      diffPercentage,
      isMatch,
      diffImage: PNG.sync.write(diff)
    };
  } catch (error) {
    // Fallback or error handling
    console.error('Error comparing screenshots:', error);
    return {
      diffPixels: -1,
      diffPercentage: 1.0,
      isMatch: false
    };
  }
}

/**
 * Creates a visual test scenario.
 */
export function createVisualTestScenario(sceneName: string): VisualScenario {
  return {
    sceneName
  };
}
