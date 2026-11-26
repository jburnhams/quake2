/**
 * The demo1 walkthrough gate, first slice: a real browser runs `map demo1` through
 * LocalHost (no network, no mocks) and the test walks the player. Later slices add the
 * renderer and a route through the level; this one proves the game runs in the page.
 *
 * Uses demo1 from the committed pak.pak, so it needs no download.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const src = (pkg: string) => path.resolve(here, '..', pkg, 'src', 'index.ts');

interface PlayerView {
  origin: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  index: number;
}

describe('demo1 in the browser', () => {
  let vite: ViteDevServer;
  let browser: Browser;
  let page: Page;
  const errors: string[] = [];

  beforeAll(async () => {
    vite = await createServer({
      configFile: false,
      root: path.join(here, 'fixtures', 'local'),
      logLevel: 'warn',
      resolve: {
        alias: {
          '@quake2ts/shared': src('shared'),
          '@quake2ts/engine': src('engine'),
          '@quake2ts/game': src('game'),
          '@quake2ts/server': src('server'),
        },
      },
      server: { port: 0, fs: { allow: [root] } },
    });
    await vite.listen();
    const address = vite.httpServer!.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    // CHROMIUM_PATH points at a preinstalled Chromium when Playwright's own is not there.
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
    page = await browser.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    if (process.env.Q2_PAGE_LOG) {
      page.on('console', (m) => console.log(`[page] ${m.text()}`));
      page.on('response', (r) => r.status() >= 400 && console.log(`[page] ${r.status()} ${r.url()}`));
    }
    const pak = `/@fs${path.join(root, 'pak.pak')}`;
    await page.goto(`http://localhost:${port}/index.html?pak=${encodeURIComponent(pak)}`);
    // A module that fails to load never runs main.ts, so a page error ends the wait too.
    await Promise.race([
      page.waitForFunction(() => (window as any).q2ready || (window as any).q2error, null, { timeout: 90_000 }),
      new Promise<void>((resolve) => page.once('pageerror', () => resolve())),
    ]);
    const failed = (await page.evaluate(() => (window as any).q2error)) ?? errors[0];
    if (failed) throw new Error(`Page failed to start: ${failed}`);
  });

  afterAll(async () => {
    await browser?.close();
    await vite?.close();
  });

  it('loads demo1 and spawns its entities', async () => {
    const map = await page.evaluate(() => (window as any).q2test.command('map demo1'));
    expect(map.name).toBe('demo1');
    expect(map.spawned).toBeGreaterThan(50);
    const player = (await page.evaluate(() => (window as any).q2test.player())) as PlayerView;
    expect(player.index).toBe(1);
    expect(errors).toEqual([]);
  });

  it('the player lands on the floor and stays there', async () => {
    const a = (await page.evaluate(() => (window as any).q2test.run(1, {}))) as PlayerView;
    const b = (await page.evaluate(() => (window as any).q2test.run(0.5, {}))) as PlayerView;
    expect(b.origin.z).toBeCloseTo(a.origin.z, 1);
    expect(Math.abs(b.velocity.z)).toBeLessThan(1);
  });

  it('walks north at run speed', async () => {
    const before = (await page.evaluate(() => (window as any).q2test.player())) as PlayerView;
    const after = (await page.evaluate(() =>
      (window as any).q2test.run(1, { forwardmove: 400, angles: { x: 0, y: 90, z: 0 } }),
    )) as PlayerView;
    expect(after.origin.y - before.origin.y).toBeGreaterThan(250);
    expect(Math.abs(after.origin.x - before.origin.x)).toBeLessThan(2);
    expect(errors).toEqual([]);
  });
});
