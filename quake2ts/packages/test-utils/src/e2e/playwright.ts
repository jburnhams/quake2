import type { Browser, Page, BrowserContext } from 'playwright';

export interface PlaywrightOptions {
  headless?: boolean;
  slowMo?: number;
  args?: string[];
  viewport?: { width: number, height: number };
}

export interface PlaywrightTestClient {
  browser: Browser;
  context: BrowserContext;
  page: Page;

  navigate(url: string): Promise<void>;
  waitForGame(timeout?: number): Promise<void>;
  injectInput(type: string, data: any): Promise<void>;
  screenshot(path?: string): Promise<Buffer>;
  close(): Promise<void>;
}

export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
  // We can import directly since playwright is a dependency
  const { chromium } = await import('playwright');

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    slowMo: options.slowMo,
    args: options.args
  });

  const context = await browser.newContext({
    viewport: options.viewport || { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  return {
    browser,
    context,
    page,

    async navigate(url: string) {
      await page.goto(url);
    },

    async waitForGame(timeout: number = 10000) {
       await waitForGameReady(page, timeout);
    },

    async injectInput(type: string, data: any) {
      // Assumes the game exposes an input injection method on window
      await page.evaluate(({type, data}: any) => {
        // @ts-ignore
        if (window.injectGameInput) {
            // @ts-ignore
            window.injectGameInput(type, data);
        }
      }, {type, data});
    },

    async screenshot(path?: string) {
      return await page.screenshot({ path });
    },

    async close() {
      await browser.close();
    }
  };
}

export async function waitForGameReady(page: Page, timeout: number = 10000) {
  // Wait for a known element or state that indicates game is ready
  // Example: canvas present and some global flag
  await page.waitForFunction(() => {
    // @ts-ignore
    return window.QUAKE2_READY === true || !!document.querySelector('canvas');
  }, null, { timeout });
}

export interface GameStateCapture {
  time: number;
  playerOrigin: [number, number, number];
  playerAngles: [number, number, number];
  entities: any[];
}

export async function captureGameState(page: Page): Promise<GameStateCapture | null> {
  return await page.evaluate(() => {
    // @ts-ignore
    if (!window.GAME_EXPORTS) return null;
    // @ts-ignore
    const game = window.GAME_EXPORTS;
    // @ts-ignore
    const player = game.entities.player;

    return {
      // @ts-ignore
      time: game.time,
      origin: player ? [player.origin[0], player.origin[1], player.origin[2]] : [0,0,0],
      angles: player ? [player.angles[0], player.angles[1], player.angles[2]] : [0,0,0],
      // @ts-ignore
      entities: game.entities.list.length
    } as unknown as GameStateCapture;
  });
}
