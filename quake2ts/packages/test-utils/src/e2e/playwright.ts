export interface PlaywrightOptions {
    headless?: boolean;
    viewport?: { width: number; height: number };
}

export interface PlaywrightTestClient {
    page: any; // Type as 'Page' from playwright in real usage, but keeping it generic here to avoid hard dependency on playwright types in this util file if not needed
    browser: any;
    navigate(url: string): Promise<void>;
    waitForGame(): Promise<void>;
    injectInput(type: string, data: any): Promise<void>;
    screenshot(name: string): Promise<Buffer>;
    close(): Promise<void>;
}

/**
 * Creates a Playwright test client.
 * Note: Requires playwright to be installed in the project.
 */
export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
    // Dynamic import to avoid hard dependency if not used
    let playwright;
    try {
        playwright = await import('playwright');
    } catch (e) {
        throw new Error('Playwright is not installed. Please install it to use this utility.');
    }

    const browser = await playwright.chromium.launch({
        headless: options.headless ?? true,
    });
    const context = await browser.newContext({
        viewport: options.viewport || { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    return {
        page,
        browser,
        async navigate(url: string) {
            await page.goto(url);
        },
        async waitForGame() {
            await waitForGameReady(page);
        },
        async injectInput(type: string, data: any) {
             // Simulate input injection via evaluate
             await page.evaluate(({ type, data }: any) => {
                 // Assumes a global function or event listener exists to receive injected input
                 console.log('Injecting input', type, data);
                 // (window as any).game.injectInput(type, data);
             }, { type, data });
        },
        async screenshot(name: string) {
            return await page.screenshot({ path: `${name}.png` });
        },
        async close() {
            await browser.close();
        }
    };
}

/**
 * Waits for the game to be ready.
 */
export async function waitForGameReady(page: any, timeout: number = 10000): Promise<void> {
    await page.waitForFunction(() => {
        // Check for some global game state or canvas presence
        return (window as any).game && (window as any).game.isRunning;
    }, { timeout });
}

export interface GameStateCapture {
    time: number;
    entities: number;
    // Add other state properties
}

/**
 * Captures current game state from the browser.
 */
export async function captureGameState(page: any): Promise<GameStateCapture> {
    return await page.evaluate(() => {
        const game = (window as any).game;
        return {
            time: game ? game.time : 0,
            entities: game && game.entities ? game.entities.length : 0
        };
    });
}
