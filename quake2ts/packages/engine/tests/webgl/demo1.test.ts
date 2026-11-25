/**
 * demo1 render gate, WebGL backend (Chromium through Playwright). See tests/demo1/shots.ts.
 * The page loads the built engine bundle and fetches the demo pak from the test server.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Page } from 'playwright';
import { createWebGLPlaywrightSetup } from '@quake2ts/test-utils';
import {
  DEMO1_SHOTS, SHOT_WIDTH, SHOT_HEIGHT, CLEAR_COLOR, SHOT_EXPECTATIONS,
  analyseShot, demoPakAvailable, expectShotBaseline, shotBrushModels, DEMO_PAK, type Demo1Shot,
} from '../demo1/shots.js';
import fs from 'node:fs';
import { PakArchive } from '../../src/assets/pak.js';
import { parseBsp, type BspMap } from '../../src/assets/bsp.js';
import type { BrushModelInstance } from '../../src/render/worldDrawList.js';

interface PageResult {
  readonly pixels: string; // base64 RGBA, top row first
  readonly glErrors: number[];
  readonly missingTextures: string[];
}

async function renderShotInPage(page: Page, shot: Demo1Shot, brushModels: BrushModelInstance[]): Promise<PageResult> {
  return page.evaluate(async ({ shot, width, height, clearColor, brushModels }) => {
    const w = window as any;
    const E = w.Quake2Engine;
    const canvas: HTMLCanvasElement = w.testCanvas;
    const gl: WebGL2RenderingContext = w.testGl;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!w.demo1World) {
      const response = await fetch('/.paks/baseq2/pak0.pak');
      if (!response.ok) throw new Error(`pak0.pak: HTTP ${response.status}`);
      const pak = E.PakArchive.fromArrayBuffer('pak0.pak', await response.arrayBuffer());
      const files = { readFile: async (p: string) => pak.readFile(p) };
      const bsp = await files.readFile('maps/demo1.bsp');
      const map = E.parseBsp(bsp.buffer.slice(bsp.byteOffset, bsp.byteOffset + bsp.byteLength));
      const prepared = await E.prepareWorld(map, files);
      w.demo1Missing = prepared.missingTextures;
      w.demo1World = w.testRenderer.uploadWorld(prepared);
    }
    while (gl.getError() !== gl.NO_ERROR) { /* drain */ }

    const camera = new E.Camera(width, height);
    camera.fov = 90;
    camera.setPosition(...shot.origin);
    camera.setRotation(...shot.angles);
    gl.viewport(0, 0, width, height);
    w.testRenderer.renderFrame({ camera, world: w.demo1World, clearColor, timeSeconds: 0, brushModels }, []);

    const glErrors: number[] = [];
    for (let e = gl.getError(); e !== gl.NO_ERROR; e = gl.getError()) glErrors.push(e);

    const raw = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    // readPixels is bottom row first; flip to match the WebGPU capture.
    const flipped = new Uint8Array(raw.length);
    const row = width * 4;
    for (let y = 0; y < height; y++) flipped.set(raw.subarray((height - 1 - y) * row, (height - y) * row), y * row);
    let binary = '';
    for (let i = 0; i < flipped.length; i += 0x8000) binary += String.fromCharCode(...flipped.subarray(i, i + 0x8000));
    return { pixels: btoa(binary), glErrors, missingTextures: w.demo1Missing };
  }, { shot, width: SHOT_WIDTH, height: SHOT_HEIGHT, clearColor: CLEAR_COLOR, brushModels });
}

describe.skipIf(!demoPakAvailable())('demo1 (WebGL)', () => {
  let page: Page;
  let map: BspMap;

  beforeAll(async () => {
    // The brush models' placement is read from the entity lump in Node and handed to the page.
    const bytes = fs.readFileSync(DEMO_PAK);
    const pak = PakArchive.fromArrayBuffer('pak0.pak', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    const bsp = pak.readFile('maps/demo1.bsp');
    map = parseBsp(bsp.buffer.slice(bsp.byteOffset, bsp.byteOffset + bsp.byteLength) as ArrayBuffer);
    const setup = await createWebGLPlaywrightSetup({ width: SHOT_WIDTH, height: SHOT_HEIGHT });
    page = setup.page;
  }, 60_000);

  for (const shot of DEMO1_SHOTS) {
    it(`renders ${shot.name} textured and lit`, async () => {
      const result = await renderShotInPage(page, shot, shotBrushModels(map, shot));
      expect(result.missingTextures).toEqual([]);
      expect(result.glErrors).toEqual([]);

      const pixels = new Uint8ClampedArray(Buffer.from(result.pixels, 'base64'));
      const stats = analyseShot(pixels, SHOT_WIDTH, SHOT_HEIGHT);
      console.log(`webgl ${shot.name}`, JSON.stringify(stats));
      await expectShotBaseline('webgl', shot.name, pixels);

      expect(stats.coverage).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minCoverage - (shot.sky ?? 0));
      expect(stats.distinctColors).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minDistinctColors);
      expect(stats.meanLuminance).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minLuminance);
      expect(stats.meanLuminance).toBeLessThanOrEqual(SHOT_EXPECTATIONS.maxLuminance);
      expect(stats.detail).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minDetail);
    }, 60_000);
  }
});
