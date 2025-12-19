
import { chromium, Browser, Page, BrowserContext, BrowserType } from 'playwright';

export interface PlaywrightOptions {
    headless?: boolean;
    viewport?: { width: number; height: number };
    args?: string[];
    recordVideo?: { dir: string; size?: { width: number; height: number } };
}

export interface PlaywrightTestClient {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    navigate(url: string): Promise<void>;
    waitForGame(timeout?: number): Promise<void>;
    injectInput(type: 'keydown' | 'keyup', key: string): Promise<void>;
    injectMouse(type: 'move' | 'down' | 'up', x?: number, y?: number, button?: number): Promise<void>;
    screenshot(path: string): Promise<void>;
    close(): Promise<void>;
}

export interface GameStateCapture {
    origin?: { x: number, y: number, z: number };
    angles?: { x: number, y: number, z: number };
    health?: number;
    // Add more properties as needed
}

/**
 * Creates a Playwright test client wrapper.
 */
export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
    const browser = await chromium.launch({
        headless: options.headless ?? true,
        args: options.args || [
            '--use-gl=egl',
            '--ignore-gpu-blocklist',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ],
    });

    const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
        recordVideo: options.recordVideo,
        deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // Helper to wait for game initialization
    // Assumes the game exposes a global 'game' object or sets a class on body
    const waitForGame = async (timeout: number = 10000) => {
         try {
             await page.waitForFunction(() => {
                 // Adjust this condition based on how your game signals readiness
                 // e.g. window.gameInitialized or document.body.classList.contains('ready')
                 return (window as any).game || document.querySelector('canvas');
             }, null, { timeout });
         } catch (e) {
             throw new Error(`Game did not initialize within ${timeout}ms`);
         }
    };

    const client: PlaywrightTestClient = {
        browser,
        context,
        page,

        async navigate(url: string) {
            await page.goto(url, { waitUntil: 'domcontentloaded' });
        },

        async waitForGame(timeout) {
            await waitForGame(timeout);
        },

        async injectInput(type, key) {
            if (type === 'keydown') {
                await page.keyboard.down(key);
            } else {
                await page.keyboard.up(key);
            }
        },

        async injectMouse(type, x = 0, y = 0, button = 0) {
            if (type === 'move') {
                await page.mouse.move(x, y);
            } else if (type === 'down') {
                await page.mouse.down({ button: button === 0 ? 'left' : (button === 2 ? 'right' : 'middle') });
            } else if (type === 'up') {
                await page.mouse.up({ button: button === 0 ? 'left' : (button === 2 ? 'right' : 'middle') });
            }
        },

        async screenshot(path) {
            await page.screenshot({ path });
        },

        async close() {
            await browser.close();
        }
    };

    return client;
}

/**
 * Waits for the game to be ready on the provided page.
 */
export async function waitForGameReady(page: Page, timeout: number = 10000): Promise<void> {
    await page.waitForFunction(() => {
        return (window as any).game || document.querySelector('canvas');
    }, null, { timeout });
}

/**
 * Captures the current game state from the browser.
 * Requires the game to expose state globally (e.g. window.game.state).
 */
export async function captureGameState(page: Page): Promise<GameStateCapture> {
    return await page.evaluate(() => {
        // This is a placeholder. You need to adapt it to your actual game global exposure.
        // For example: return window.game.getLocalPlayerState();
        const game = (window as any).game;
        if (!game) return {};

        // Example: access player entity
        // return {
        //     origin: game.player?.origin,
        //     health: game.player?.health
        // };
        return {};
    });
}
