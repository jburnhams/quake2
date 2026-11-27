/**
 * The /watch page end to end, in a real browser with WebGL: the explorer app's own dev server
 * with the full demo pak0.pak, which has demos/q2demo1.dm2 (the committed pak.pak has only the
 * 3.00 demo1.dm2, which is refused). It plays the recording and seeks it, through the eyes and
 * from behind, and checks the picture changes as it plays and no page error is thrown.
 *
 * Needs .paks/baseq2/pak0.pak (scripts/fetch-paks.sh; CI's demo-paks action); without it the
 * suite is skipped. WATCH_SHOTS=<dir> also writes the screenshots there.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type Plugin, type ViteDevServer } from 'vite';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const explorer = path.join(root, 'apps', 'explorer');
const pak0 = process.env.Q2_DEMO_PAK ?? path.join(root, '.paks', 'baseq2', 'pak0.pak');
const havePak = existsSync(pak0);
const shots = process.env.WATCH_SHOTS;

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

describe.skipIf(!havePak)('/watch plays q2demo1.dm2 in the browser', () => {
  let vite: ViteDevServer;
  let browser: Browser;
  let page: Page;
  let base = '';
  const errors: string[] = [];

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
    base = `http://localhost:${typeof address === 'object' && address ? address.port : 0}`;
    browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || undefined,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
  });

  afterAll(async () => {
    await browser?.close();
    await vite?.close();
  });

  /** The stage's canvas once the world is drawn, and its picture. */
  const stage = async () => {
    const canvas = page.getByRole('img', { name: /Drag/ });
    await canvas.waitFor({ timeout: 110_000 });
    await page.waitForTimeout(1500); // the models load after the world
    return canvas;
  };
  /**
   * Goes to a moment. Waits only for the navigation to commit, not for "load": on a CI runner's
   * software WebGL the page before can hold the browser past goto's 30 s, and stage() already
   * waits for the drawn world, which is what the tests need.
   */
  const open = (url: string) => page.goto(url, { waitUntil: 'commit' });
  const shot = async (name: string) => {
    const png = await (await stage()).screenshot();
    if (shots) {
      mkdirSync(shots, { recursive: true });
      writeFileSync(path.join(shots, `${name}.png`), png);
    }
    return png;
  };

  it('opens on a moment from the link, through the player\'s eyes', async () => {
    await open(`${base}/watch?t=100`);
    const at10 = await shot('watch-eyes-10s');
    expect(await page.getByText('Installation').count()).toBeGreaterThan(0);
    expect(await page.getByText('maps/demo2.bsp').count()).toBeGreaterThan(0);
    await open(`${base}/watch?t=300`);
    const at30 = await shot('watch-eyes-30s');
    expect(at30.equals(at10)).toBe(false);
    expect(errors).toEqual([]);
  });

  it('plays, and writes where it stopped to the URL', async () => {
    await open(`${base}/watch?t=50`);
    await stage();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    const t = Number(new URL(page.url()).searchParams.get('t'));
    expect(t).toBeGreaterThan(55);
    expect(errors).toEqual([]);
  });

  it('follows the player from behind', async () => {
    await open(`${base}/watch?camera=behind&t=100`);
    await shot('watch-behind-10s');
    expect(errors).toEqual([]);
  });
});
