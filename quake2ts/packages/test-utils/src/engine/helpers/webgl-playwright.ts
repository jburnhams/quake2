/**
 * Playwright-based WebGL testing utilities
 *
 * Provides helpers for running WebGL visual tests in a real browser using Playwright.
 * This enables proper WebGL 2.0 support with real shader compilation and rendering.
 */

import { chromium, Browser, Page } from 'playwright';
import { expectSnapshot, SnapshotTestOptions } from '../../visual/snapshots.js';
import path from 'path';

export interface WebGLPlaywrightSetup {
  browser: Browser;
  page: Page;
  width: number;
  height: number;
  cleanup: () => Promise<void>;
}

export interface WebGLPlaywrightOptions {
  width?: number;
  height?: number;
  headless?: boolean;
}

/**
 * Creates a Playwright-based WebGL test setup with a real browser and WebGL2 context.
 * This provides full WebGL 2.0 support including GLSL 3.00 ES shaders.
 */
export async function createWebGLPlaywrightSetup(
  options: WebGLPlaywrightOptions = {}
): Promise<WebGLPlaywrightSetup> {
  const width = options.width ?? 256;
  const height = options.height ?? 256;
  const headless = options.headless ?? true;

  // Launch browser
  const browser = await chromium.launch({
    headless,
    args: [
      '--disable-web-security', // Allow loading local resources
      '--use-gl=swiftshader', // Use SwiftShader for software rendering (CI-friendly)
      '--disable-gpu-sandbox',
    ]
  });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Create a basic HTML page with a canvas
  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
          canvas {
            display: block;
            image-rendering: pixelated;
          }
        </style>
      </head>
      <body>
        <canvas id="glCanvas" width="${width}" height="${height}"></canvas>
      </body>
    </html>
  `);

  // Wait for canvas to be ready
  await page.waitForSelector('#glCanvas');

  // Verify WebGL2 support
  const hasWebGL2 = await page.evaluate(() => {
    const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    return gl !== null;
  });

  if (!hasWebGL2) {
    await browser.close();
    throw new Error('WebGL2 is not supported in the browser');
  }

  const cleanup = async () => {
    await browser.close();
  };

  return {
    browser,
    page,
    width,
    height,
    cleanup
  };
}

/**
 * Captures the canvas content as pixel data (RGBA, Uint8ClampedArray).
 */
export async function captureWebGLCanvas(
  page: Page,
  width: number,
  height: number
): Promise<Uint8ClampedArray> {
  const pixelData = await page.evaluate(({ width, height }) => {
    const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      throw new Error('WebGL2 context not available');
    }

    // Ensure all WebGL commands are completed
    gl.finish();

    // Read pixels from the canvas
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Debug: count non-zero pixels
    let nonZero = 0;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] !== 0) nonZero++;
    }
    console.log(`[CAPTURE DEBUG] Non-zero bytes: ${nonZero}/${pixels.length}, first 16 bytes:`, Array.from(pixels.slice(0, 16)).join(','));

    // Flip vertically (WebGL coordinates are bottom-up, images are top-down)
    const flipped = new Uint8Array(pixels.length);
    const rowSize = width * 4;
    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * rowSize;
      const dstRow = y * rowSize;
      for (let x = 0; x < rowSize; x++) {
        flipped[dstRow + x] = pixels[srcRow + x];
      }
    }

    return Array.from(flipped);
  }, { width, height });

  const result = new Uint8ClampedArray(pixelData);
  let nonZero = 0;
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== 0) nonZero++;
  }
  console.log(`[CAPTURE] Received ${pixelData.length} bytes, non-zero: ${nonZero}, first 40 bytes:`, Array.from(result.slice(0, 40)).join(','));
  return result;
}

/**
 * Helper to render and capture a WebGL scene in a Playwright browser.
 * NOTE: This captures AFTER the renderFn completes, but they are separate page.evaluate() calls.
 * If you need to combine render+capture in one evaluate, pass a render function that returns pixels.
 */
export async function renderAndCaptureWebGLPlaywright(
  setup: WebGLPlaywrightSetup,
  renderFn: (page: Page) => Promise<void>
): Promise<Uint8ClampedArray> {
  // Execute the render function
  await renderFn(setup.page);

  // Add a small delay to ensure rendering completes
  await setup.page.waitForTimeout(100);

  // Capture the result
  return await captureWebGLCanvas(setup.page, setup.width, setup.height);
}

/**
 * Runs a WebGL visual test using Playwright and compares against a baseline snapshot.
 */
export async function expectWebGLPlaywrightSnapshot(
  setup: WebGLPlaywrightSetup,
  renderFn: (page: Page) => Promise<void>,
  options: Omit<SnapshotTestOptions, 'width' | 'height'>
): Promise<void> {
  const pixels = await renderAndCaptureWebGLPlaywright(setup, renderFn);

  await expectSnapshot(pixels, {
    ...options,
    width: setup.width,
    height: setup.height
  });
}

/**
 * Creates a simple test helper that bundles setup, render, capture, and cleanup.
 *
 * Usage:
 * ```ts
 * await testWebGLWithPlaywright(async (page) => {
 *   await page.evaluate(() => {
 *     const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
 *     const gl = canvas.getContext('webgl2')!;
 *     // ... render code
 *   });
 * }, {
 *   name: 'my-test',
 *   width: 256,
 *   height: 256
 * });
 * ```
 */
export async function testWebGLWithPlaywright(
  renderFn: (page: Page) => Promise<void>,
  options: SnapshotTestOptions & WebGLPlaywrightOptions
): Promise<void> {
  const setup = await createWebGLPlaywrightSetup(options);

  try {
    await expectWebGLPlaywrightSnapshot(setup, renderFn, options);
  } finally {
    await setup.cleanup();
  }
}
