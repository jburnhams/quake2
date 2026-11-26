/**
 * Playwright-based WebGL testing utilities for quake2ts renderer
 *
 * Provides helpers for running WebGL visual tests in a real browser using Playwright.
 * Loads the actual built renderer code via a static server, similar to e2e-tests.
 */

import type { Browser, Page, BrowserContext } from 'playwright';
import { expectSnapshot, SnapshotTestOptions } from '../../visual/snapshots.js';
import { expectAnimationSnapshot, AnimationSnapshotOptions } from '../../visual/animation-snapshots.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import path from 'path';
import fs from 'fs';
import { PNG } from 'pngjs';

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

// Singleton state for reusing the browser/server across tests
let sharedSetup: {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  server: any;
  serverUrl: string;
} | undefined;

function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }
  // Fallback to process.cwd() if not found (though unexpected in this repo)
  return process.cwd();
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

  // Re-use existing setup if available
  if (sharedSetup) {
    const { page, browser, context, server } = sharedSetup;

    // Ensure the page is still valid (not crashed)
    if (!page.isClosed()) {
      // Resize viewport to match current test requirements
      await page.setViewportSize({ width, height });

      return {
        browser,
        context,
        page,
        width,
        height,
        server,
        // No-op cleanup for shared instance to keep it alive for next test
        cleanup: async () => {
          // We intentionally do not close the browser/server here.
          // It will be closed when the Node process exits.
        }
      };
    } else {
      // If page is closed/crashed, discard shared setup and recreate
      sharedSetup = undefined;
    }
  }

  // Dynamic imports for optional dependencies
  let chromium;
  let handler;

  try {
    const playwright = await import('playwright');
    chromium = playwright.chromium;
  } catch (e) {
    throw new Error('Failed to load "playwright" package. Please ensure it is installed.');
  }

  try {
    const serveHandler = await import('serve-handler');
    handler = serveHandler.default;
  } catch (e) {
    throw new Error('Failed to load "serve-handler" package. Please ensure it is installed.');
  }

  // Start static server to serve built files
  // Find workspace root robustly (works from src or dist, and regardless of CWD)
  // We start looking from __dirname (which might be src/... or dist/...)
  const repoRoot = findWorkspaceRoot(__dirname);

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
    // else console.log(`[Browser] ${msg.text()}`); // Reduce noise
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

  // Store as shared setup
  sharedSetup = {
    browser,
    context,
    page,
    server: staticServer,
    serverUrl
  };

  const cleanup = async () => {
    // For the initial creator, we effectively "hand off" ownership to the global sharedSetup.
    // So we don't close it here either, unless we want to implement ref-counting.
    // For simplicity, we keep it open until process exit.
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
 * @param width - Optional width to resize the canvas to
 * @param height - Optional height to resize the canvas to
 * @param frameIndex - Optional frame index passed to the render function
 * @returns Captured pixel data
 */
export async function renderAndCaptureWebGLPlaywright(
  page: Page,
  renderFn: string,
  width?: number,
  height?: number,
  frameIndex: number = 0
): Promise<Uint8ClampedArray> {
  try {
    // 1. Render content
    await page.evaluate(({ code, width, height, frameIndex }) => {
      const renderer = (window as any).testRenderer;
      const gl = (window as any).testGl;
      const canvas = (window as any).testCanvas;

      if (!renderer || !gl || !canvas) {
        throw new Error('Renderer not initialized');
      }

      // Resize canvas if needed
      if (width !== undefined && height !== undefined) {
        // Only resize if actually changed to avoid flicker/overhead
        if (canvas.width !== width || canvas.height !== height) {
           canvas.width = width;
           canvas.height = height;
           gl.viewport(0, 0, width, height);
        }
      }

      try {
        // Execute the render function
        const fn = new Function('renderer', 'gl', 'frameIndex', code);
        fn(renderer, gl, frameIndex);
      } catch (err: any) {
        // Capture context for better debugging
        throw new Error(`Renderer Execution Error: ${err.message}\nCode:\n${code}`);
      }

      // Ensure rendering is complete
      gl.finish();
    }, { code: renderFn, width, height, frameIndex });

    // 2. Capture pixels using page.screenshot (fastest method)
    // We assume canvas covers viewport because we set viewport size to match canvas in setup
    const buffer = await page.screenshot({
        omitBackground: true,
        type: 'png'
    });

    // 3. Decode PNG to raw pixels
    const png = PNG.sync.read(buffer);
    return new Uint8ClampedArray(png.data);
  } catch (err: any) {
    // Re-throw with clear message
    throw new Error(`Browser Test Error: ${err.message}`);
  }
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
    const pixels = await renderAndCaptureWebGLPlaywright(
        setup.page,
        renderCode,
        options.width,
        options.height
    );

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

/**
 * Runs a WebGL animated visual test with the actual quake2ts renderer.
 *
 * Usage:
 * ```ts
 * await testWebGLAnimation(`
 *   // frameIndex is available here
 *   gl.clearColor(frameIndex * 0.1, 0, 0, 1);
 *   gl.clear(gl.COLOR_BUFFER_BIT);
 * `, {
 *   name: 'animated-red',
 *   description: 'Fading red animation',
 *   width: 256,
 *   height: 256,
 *   frameCount: 10,
 *   fps: 10,
 *   snapshotDir: __dirname
 * });
 * ```
 */
export async function testWebGLAnimation(
  renderCode: string,
  options: AnimationSnapshotOptions & WebGLPlaywrightOptions
): Promise<void> {
  const setup = await createWebGLPlaywrightSetup(options);

  try {
    await expectAnimationSnapshot(async (frameIndex) => {
        return renderAndCaptureWebGLPlaywright(
            setup.page,
            renderCode,
            options.width,
            options.height,
            frameIndex
        );
    }, {
      name: options.name,
      description: options.description,
      width: setup.width,
      height: setup.height,
      frameCount: options.frameCount,
      fps: options.fps,
      updateBaseline: options.updateBaseline,
      snapshotDir: options.snapshotDir,
      threshold: options.threshold,
      maxDifferencePercent: options.maxDifferencePercent
    });
  } finally {
    await setup.cleanup();
  }
}
