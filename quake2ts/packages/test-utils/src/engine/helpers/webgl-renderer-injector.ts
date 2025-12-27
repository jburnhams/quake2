/**
 * Helper to inject and test the WebGL renderer in a Playwright browser
 */

import { Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

/**
 * Bundles and injects the renderer code into the page.
 * This allows testing the actual renderer implementation in a real browser.
 */
export async function injectRenderer(page: Page, rendererPath: string): Promise<void> {
  // For now, we'll inject the renderer code directly
  // In the future, this could use a bundler like esbuild

  const code = await fs.readFile(rendererPath, 'utf-8');
  await page.addScriptTag({ content: code });
}

/**
 * Helper to create a renderer instance in the browser page
 */
export async function createRendererInBrowser(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
    const gl = canvas.getContext('webgl2');

    if (!gl) {
      throw new Error('Failed to get WebGL2 context');
    }

    // Store gl context globally for tests to use
    (window as any).gl = gl;
    (window as any).canvas = canvas;
  });
}

/**
 * Registers a texture/pic in the browser's renderer
 */
export async function registerPicInBrowser(
  page: Page,
  name: string,
  imageData: ArrayBuffer
): Promise<number> {
  return await page.evaluate(({ name, data }) => {
    const renderer = (window as any).renderer;
    if (!renderer) {
      throw new Error('Renderer not initialized');
    }

    // Convert array to Uint8Array in browser context
    const uint8Data = new Uint8Array(data);
    return renderer.registerPic(name, uint8Data.buffer);
  }, { name, data: Array.from(new Uint8Array(imageData)) });
}

/**
 * Creates a simple checkerboard texture for testing
 */
export function createCheckerboardTexture(
  width: number,
  height: number,
  checkerSize: number,
  color1: [number, number, number, number],
  color2: [number, number, number, number]
): { buffer: ArrayBuffer; width: number; height: number } {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const checkerX = Math.floor(x / checkerSize);
      const checkerY = Math.floor(y / checkerSize);
      const isColor1 = (checkerX + checkerY) % 2 === 0;
      const color = isColor1 ? color1 : color2;

      const idx = (y * width + x) * 4;
      data[idx + 0] = Math.floor(color[0] * 255);
      data[idx + 1] = Math.floor(color[1] * 255);
      data[idx + 2] = Math.floor(color[2] * 255);
      data[idx + 3] = Math.floor(color[3] * 255);
    }
  }

  return {
    buffer: data.buffer,
    width,
    height
  };
}
