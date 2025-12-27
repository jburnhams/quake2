/**
 * Playwright-based WebGL testing utilities for quake2ts renderer
 *
 * Provides helpers for running WebGL visual tests in a real browser using Playwright.
 * Loads the actual built renderer code via a static server, similar to e2e-tests.
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { expectSnapshot, SnapshotTestOptions } from '../../visual/snapshots.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import handler from 'serve-handler';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WebGLPlaywrightSetup {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  width: number;
  height: number;
  server?: any;
  cleanup: () => Promise<void>;
}

export interface WebGLPlaywrightOptions {
  width?: number;
  height?: number;
  headless?: boolean;
}

/**
 * Creates a Playwright-based WebGL test setup with the actual quake2ts renderer.
 * Starts a static server, loads the built renderer bundle, and provides a clean testing environment.
 */
export async function createWebGLPlaywrightSetup(
  options: WebGLPlaywrightOptions = {}
): Promise<WebGLPlaywrightSetup> {
  const width = options.width ?? 256;
  const height = options.height ?? 256;
  const headless = options.headless ?? true;

  // Start static server to serve built files
  // Serve from repo root so we can access packages/engine/dist
  const repoRoot = path.resolve(__dirname, '../../../../..');

  const staticServer = createServer((request: IncomingMessage, response: ServerResponse) => {
    return handler(request, response, {
      public: repoRoot,
      cleanUrls: false,
      headers: [
        {
          source: '**/*',
          headers: [
            { key: 'Cache-Control', value: 'no-cache' },
            { key: 'Access-Control-Allow-Origin', value: '*' },
            { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
            { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
          ]
        }
      ]
    });
  });

  const serverUrl = await new Promise<string>((resolve) => {
    staticServer.listen(0, () => {
      const addr = staticServer.address();
      const port = typeof addr === 'object' ? addr?.port : 0;
      const url = `http://localhost:${port}/packages/engine/tests/webgl/fixtures/renderer-test.html`;
      console.log(`WebGL test server serving from ${repoRoot} at ${url}`);
      resolve(url);
    });
  });

  // Launch browser
  const browser = await chromium.launch({
    headless,
    args: [
      '--use-gl=swiftshader',
      '--disable-gpu-sandbox',
      '--ignore-gpu-blocklist'
    ]
  });

  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  // Log browser console for debugging
  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`);
    else console.log(`[Browser] ${msg.text()}`);
  });

  page.on('pageerror', err => {
    console.error(`[Browser Page Error] ${err.message}`);
  });

  // Navigate to the test harness
  await page.goto(serverUrl, { waitUntil: 'domcontentloaded' });

  // Initialize renderer
  await page.evaluate(`window.createRendererTest()`);

  // Wait for renderer to be ready
  await page.waitForFunction(() => (window as any).testRenderer !== undefined, { timeout: 5000 });

  const cleanup = async () => {
    await browser.close();
    staticServer.close();
  };

  return {
    browser,
    context,
    page,
    width,
    height,
    server: staticServer,
    cleanup
  };
}

/**
 * Executes a rendering function using the actual quake2ts renderer and captures the result.
 * This must happen in a single page.evaluate() call to preserve WebGL state.
 *
 * @param page - Playwright page
 * @param renderFn - Function code as string that uses window.testRenderer
 * @returns Captured pixel data
 */
export async function renderAndCaptureWebGLPlaywright(
  page: Page,
  renderFn: string
): Promise<Uint8ClampedArray> {
  const pixelData = await page.evaluate((code) => {
    const renderer = (window as any).testRenderer;
    const gl = (window as any).testGl;

    if (!renderer || !gl) {
      throw new Error('Renderer not initialized');
    }

    // Execute the render function
    const fn = new Function('renderer', 'gl', code);
    fn(renderer, gl);

    // Ensure rendering is complete
    gl.finish();

    // Capture pixels
    return (window as any).captureCanvas();
  }, renderFn);

  return new Uint8ClampedArray(pixelData);
}

/**
 * Runs a WebGL visual test with the actual quake2ts renderer.
 *
 * Usage:
 * ```ts
 * await testWebGLRenderer(`
 *   // Clear background
 *   gl.clearColor(0, 0, 0, 1);
 *   gl.clear(gl.COLOR_BUFFER_BIT);
 *
 *   // Use renderer API
 *   renderer.begin2D();
 *   renderer.drawfillRect(64, 64, 128, 128, [0, 0, 1, 1]);
 *   renderer.end2D();
 * `, {
 *   name: 'blue-rect',
 *   description: 'Blue rectangle test',
 *   width: 256,
 *   height: 256,
 *   snapshotDir: __dirname
 * });
 * ```
 */
export async function testWebGLRenderer(
  renderCode: string,
  options: SnapshotTestOptions & WebGLPlaywrightOptions
): Promise<void> {
  const setup = await createWebGLPlaywrightSetup(options);

  try {
    const pixels = await renderAndCaptureWebGLPlaywright(setup.page, renderCode);

    await expectSnapshot(pixels, {
      name: options.name,
      description: options.description,
      width: setup.width,
      height: setup.height,
      updateBaseline: options.updateBaseline,
      snapshotDir: options.snapshotDir
    });
  } finally {
    await setup.cleanup();
  }
}
