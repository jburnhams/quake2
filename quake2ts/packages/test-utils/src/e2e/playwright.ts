import type { Page, Browser, BrowserContext } from 'playwright';

export interface PlaywrightOptions {
    headless?: boolean;
    viewport?: { width: number; height: number };
}

export interface PlaywrightTestClient {
    page: Page;
    browser: Browser;
    context: BrowserContext;
    navigate(url: string): Promise<void>;
    waitForGame(): Promise<void>;
    injectInput(input: any): Promise<void>;
    screenshot(name: string): Promise<Buffer>;
    close(): Promise<void>;
}

/**
 * Creates a Playwright test client wrapper.
 * Requires playwright to be installed and available.
 */
export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
        headless: options.headless ?? true,
    });

    const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    return {
        page,
        browser,
        context,
        navigate: async (url) => {
            await page.goto(url);
        },
        waitForGame: async () => {
            await waitForGameReady(page);
        },
        injectInput: async (input) => {
            // Implementation depends on how input is exposed
        },
        screenshot: async (name) => {
            return await page.screenshot({ path: `${name}.png` });
        },
        close: async () => {
            await browser.close();
        }
    };
}

export async function waitForGameReady(page: Page, timeout: number = 30000): Promise<void> {
    await page.waitForFunction(() => {
        // @ts-ignore
        return window.quake2 && window.quake2.ready;
    }, { timeout });
}

export interface GameStateCapture {
    // Define game state properties
    player: any;
    entities: any[];
}

export async function captureGameState(page: Page): Promise<GameStateCapture> {
    return await page.evaluate(() => {
        // @ts-ignore
        if (!window.quake2) return null;
        // @ts-ignore
        return window.quake2.getState();
    });
}
