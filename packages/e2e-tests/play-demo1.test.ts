/**
 * The /play page end to end, in a real browser with WebGL: the explorer app's own dev server,
 * the full demo pak0.pak (the committed pak.pak has no monster models), and the page's real
 * input path (mouse movement to look, the mouse button to fire).
 *
 * It checks what a player sees: the monsters are drawn, and a shot lands under the crosshair
 * whether the player looks up or down. Both were broken while every unit test passed: monsters
 * spawned with modelindex 0 (so the renderer skipped them), and blaster bolts were invisible.
 *
 * Needs .paks/baseq2/pak0.pak (scripts/fetch-paks.sh; CI's demo-paks action); without
 * it the suite is skipped, saying so.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const explorer = path.join(root, 'apps', 'explorer');
const pak0 = process.env.Q2_DEMO_PAK ?? path.join(root, '.paks', 'baseq2', 'pak0.pak');
const havePak = existsSync(pak0);

/** Serves the full demo pak where the dev build looks for its PAK (BASE_URL + pak.pak). */
const fullDemoPak = (): Plugin => ({
  name: 'full-demo-pak',
  configureServer(server) {
    server.middlewares.use('/pak.pak', (_req, res) => {
      res.setHeader('content-type', 'application/octet-stream');
      res.setHeader('content-length', String(statSync(pak0).size));
      createReadStream(pak0).pipe(res);
    });
  },
});

type Inspection = {
  viewProjection: number[];
  drawnModels: string[];
  impacts: { type: number; pos: { x: number; y: number; z: number } }[];
  pitch: number;
  yaw: number;
};

const TE_BLASTER = 2;

/** A world point through the view-projection matrix (column-major) to normalised screen coordinates. */
function toScreen(m: number[], p: { x: number; y: number; z: number }): { x: number; y: number } {
  const clip = [0, 1, 2, 3].map((r) => m[r] * p.x + m[4 + r] * p.y + m[8 + r] * p.z + m[12 + r]);
  return { x: clip[0] / clip[3], y: clip[1] / clip[3] };
}

describe.skipIf(!havePak)('/play on demo1 in the browser', () => {
  let vite: ViteDevServer;
  let browser: Browser;
  let page: Page;
  const errors: string[] = [];

  const inspect = () => page.evaluate(() => (window as unknown as { q2play: { inspect(): Inspection } }).q2play.inspect());

  beforeAll(async () => {
    vite = await createServer({
      configFile: path.join(explorer, 'vite.config.ts'),
      root: explorer,
      logLevel: 'warn',
      plugins: [fullDemoPak()],
      server: { port: 0 },
    });
    await vite.listen();
    const address = vite.httpServer!.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // SwiftShader gives headless Chromium WebGL 2 without a GPU. CHROMIUM_PATH points at a
    // preinstalled Chromium when Playwright's own is not there.
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://localhost:${port}/play`);
    await page.waitForFunction(() => (window as unknown as { q2play?: unknown }).q2play, null, { timeout: 110_000 });

    // Put the mouse where the moves start before the game listens, so the first move is not a jump
    // from the corner. Then capture it as a click does: headless Chromium grants no pointer lock,
    // so the page is told the canvas has it (the page reads document.pointerLockElement).
    await page.mouse.move(512, 320);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      Object.defineProperty(document, 'pointerLockElement', { get: () => canvas, configurable: true });
      document.dispatchEvent(new Event('pointerlockchange'));
    });
  });

  afterAll(async () => {
    await browser?.close();
    await vite?.close();
  });

  it('draws the monsters', async () => {
    // Models load in the background the first time the game names them.
    await expect
      .poll(async () => (await inspect()).drawnModels.filter((m) => m.startsWith('models/monsters/')), { timeout: 30_000 })
      .not.toHaveLength(0);
    const drawn = (await inspect()).drawnModels;
    expect(drawn).toContain('models/monsters/soldier/tris.md2');
    expect(errors).toEqual([]);
  });

  it.each([
    ['down', 300],
    ['up', -600], // from 20 degrees down to 20 up
  ])('a shot fired looking %s lands under the crosshair', async (_, dy) => {
    // Each move is from where the last one left the mouse: 20 degrees down, then 40 back up.
    const from = (await inspect()).pitch;
    await page.mouse.move(512, 320 + (dy > 0 ? dy : 300 + dy), { steps: 10 });
    await page.waitForTimeout(200);
    const before = await inspect();
    expect(Math.sign(before.pitch - from)).toBe(Math.sign(dy)); // mouse down looks down (positive pitch)
    expect(Math.sign(before.pitch)).toBe(Math.sign(dy));

    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.up();

    let impact: Inspection['impacts'][number] | undefined;
    await expect
      .poll(async () => (impact = (await inspect()).impacts.find((i) => i.type === TE_BLASTER)), { timeout: 5_000 })
      .toBeDefined();
    const onScreen = toScreen(before.viewProjection, impact!.pos);
    // The centre of the screen is (0, 0); the gun is below and to the right of the eye, and the
    // bolt turns in to meet the crosshair.
    expect(Math.abs(onScreen.x)).toBeLessThan(0.1);
    expect(Math.abs(onScreen.y)).toBeLessThan(0.1);
    expect(errors).toEqual([]);
  });
});

if (!havePak) {
  console.warn(`play-demo1: skipped, no ${pak0} (run scripts/fetch-paks.sh)`);
}
