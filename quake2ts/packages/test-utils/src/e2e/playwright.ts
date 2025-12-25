import type { Browser, BrowserContext, Page } from 'playwright';

export interface PlaywrightOptions {
  headless?: boolean;
  width?: number;
  height?: number;
}

export interface PlaywrightTestClient {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  navigate(url: string): Promise<void>;
  waitForGame(timeout?: number): Promise<void>;
  injectInput(type: string, data: any): Promise<void>;
  screenshot(name: string): Promise<Buffer>;
  close(): Promise<void>;
}

export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
  // Dynamic import to avoid hard dependency on playwright
  let chromium;
  try {
    const pw = await import('playwright');
    chromium = pw.chromium;
  } catch (e) {
    throw new Error('Playwright is not installed. Please install playwright to use createPlaywrightTestClient.');
  }

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: ['--use-gl=egl', '--ignore-gpu-blocklist']
  });

  const context = await browser.newContext({
    viewport: {
      width: options.width || 1280,
      height: options.height || 720
    }
  });

  const page = await context.newPage();

  return {
    browser,
    context,
    page,
    async navigate(url: string) {
      await page.goto(url);
    },
    async waitForGame(timeout = 10000) {
      await page.waitForFunction(() => (window as any).game?.isRunning, { timeout });
    },
    async injectInput(type: string, data: any) {
      await page.evaluate(({ type, data }) => {
        (window as any).game?.injectInput?.(type, data);
      }, { type, data });
    },
    async screenshot(name: string) {
      return page.screenshot({ path: `${name}.png` });
    },
    async close() {
      await browser.close();
    }
  };
}

export async function waitForGameReady(page: Page, timeout = 10000) {
  await page.waitForFunction(() => (window as any).game?.isRunning, { timeout });
}

export interface GameStateCapture {
  time: number;
  entities: any[];
}

export async function captureGameState(page: Page): Promise<GameStateCapture> {
  return page.evaluate(() => {
    const game = (window as any).game;
    if (!game) return { time: 0, entities: [] };
    return {
      time: game.time || 0,
      entities: game.entities || []
    };
  });
}
