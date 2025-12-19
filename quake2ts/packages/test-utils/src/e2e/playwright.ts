
import { chromium, Browser, Page, BrowserContext, BrowserContextOptions, LaunchOptions } from 'playwright';
import { createServer, IncomingMessage, ServerResponse, Server } from 'http';
import handler from 'serve-handler';
import path from 'path';

/**
 * Interface for Test Client options
 */
export interface PlaywrightOptions {
  headless?: boolean;
  width?: number;
  height?: number;
  clientUrl?: string; // If provided, uses this URL. Otherwise starts a static server.
  serverUrl?: string; // Game server URL to connect to via query param
  rootPath?: string; // Root path for static server (defaults to process.cwd())
  launchOptions?: LaunchOptions;
  contextOptions?: BrowserContextOptions;
}

export interface PlaywrightTestClient {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    server?: Server; // HTTP server instance
    close: () => Promise<void>;
    navigate: (url?: string) => Promise<void>;
    waitForGame: (timeout?: number) => Promise<void>;
    injectInput: (type: string, data: any) => Promise<void>;
}

/**
 * Creates a Playwright-controlled browser environment for testing.
 * Can start a static server to serve the game client if no clientUrl is provided.
 */
export async function createPlaywrightTestClient(options: PlaywrightOptions = {}): Promise<PlaywrightTestClient> {
  let staticServer: Server | undefined;
  let clientUrl = options.clientUrl;
  const rootPath = options.rootPath || process.cwd();

  if (!clientUrl) {
    // Start a local static server
    staticServer = createServer((request: IncomingMessage, response: ServerResponse) => {
      return handler(request, response, {
        public: rootPath,
        cleanUrls: false,
        headers: [
          {
            source: '**/*',
            headers: [
              { key: 'Cache-Control', value: 'no-cache' },
              { key: 'Access-Control-Allow-Origin', value: '*' },
              { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
              { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
            ]
          }
        ]
      });
    });

    await new Promise<void>((resolve) => {
        if (!staticServer) return;
        staticServer.listen(0, () => {
            const addr = staticServer?.address();
            const port = typeof addr === 'object' ? addr?.port : 0;
            clientUrl = `http://localhost:${port}`;
            console.log(`Test client serving from ${rootPath} at ${clientUrl}`);
            resolve();
        });
    });
  }

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
        '--use-gl=egl',
        '--ignore-gpu-blocklist',
        ...(options.launchOptions?.args || [])
    ],
    ...options.launchOptions
  });

  const width = options.width || 1280;
  const height = options.height || 720;

  const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
      ...options.contextOptions
  });

  const page = await context.newPage();

  // Helper for closing
  const close = async () => {
    await browser.close();
    if (staticServer) {
        staticServer.close();
    }
  };

  const navigate = async (url?: string) => {
      const targetUrl = url || clientUrl;
      if (!targetUrl) throw new Error("No URL to navigate to");

      let finalUrl = targetUrl;
      if (options.serverUrl && !targetUrl.includes('connect=')) {
          const separator = targetUrl.includes('?') ? '&' : '?';
          finalUrl = `${targetUrl}${separator}connect=${encodeURIComponent(options.serverUrl)}`;
      }

      console.log(`Navigating to: ${finalUrl}`);
      await page.goto(finalUrl, { waitUntil: 'domcontentloaded' });
  };

  return {
      browser,
      context,
      page,
      server: staticServer,
      close,
      navigate,
      waitForGame: async (timeout = 10000) => {
          await waitForGameReady(page, timeout);
      },
      injectInput: async (type, data) => {
          // Placeholder for input injection if we have a mechanism
          await page.evaluate(({type, data}) => {
             // @ts-ignore
             if (window.injectGameInput) window.injectGameInput(type, data);
          }, {type, data});
      }
  };
}

export async function waitForGameReady(page: Page, timeout: number = 10000): Promise<void> {
    try {
        await page.waitForFunction(() => {
            // @ts-ignore
            return window.gameInstance && window.gameInstance.isReady; // Example check
        }, null, { timeout });
    } catch (e) {
        await page.waitForSelector('canvas', { timeout });
    }
}

export interface GameStateCapture {
    [key: string]: any;
}

export async function captureGameState(page: Page): Promise<GameStateCapture> {
    return await page.evaluate(() => {
        // @ts-ignore
        if (window.gameInstance && window.gameInstance.getState) {
            // @ts-ignore
            return window.gameInstance.getState();
        }
        return {};
    });
}
