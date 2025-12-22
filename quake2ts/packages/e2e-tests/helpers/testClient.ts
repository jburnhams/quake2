import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import handler from 'serve-handler';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlaywrightTestClient } from '@quake2ts/test-utils';

// Fix for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Interface for Test Client options
 */
export interface TestClientOptions {
  headless?: boolean;
  clientUrl?: string; // URL where the web client is hosted
  width?: number;
  height?: number;
}

export interface TestClient extends PlaywrightTestClient {
    context?: BrowserContext; // Made optional as test-utils might abstract it differently, but keeping for compatibility
    server?: any; // HTTP server instance
}

/**
 * Launches a browser instance and loads the game client.
 *
 * @param serverUrl - The address of the game server to connect to (e.g., "ws://localhost:27910")
 * @param options - Configuration options for the browser client
 * @returns Object containing browser, context, and page instances
 */
export async function launchBrowserClient(serverUrl: string, options: TestClientOptions = {}): Promise<TestClient> {
  let staticServer;
  let clientUrl = options.clientUrl;

  if (!clientUrl) {
    // Start a local static server to serve the client and fixtures
    // We serve the root of the repo so we can access packages/client/dist
    const repoRoot = path.resolve(__dirname, '../../..');

    staticServer = createServer((request: IncomingMessage, response: ServerResponse) => {
      return handler(request, response, {
        public: repoRoot,
        cleanUrls: false, // Ensure we don't redirect .html -> extensionless which might drop query params like ?connect=
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
        staticServer.listen(0, () => {
            const addr = staticServer.address();
            const port = typeof addr === 'object' ? addr?.port : 0;
            clientUrl = `http://localhost:${port}/packages/e2e-tests/fixtures/real-client.html`;
            console.log(`Test client serving from ${repoRoot} at ${clientUrl}`);
            resolve();
        });
    });
  }

  // We manually construct the client to ensure it conforms to the TestClient interface
  // which extends PlaywrightTestClient from test-utils.

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
        '--use-gl=egl',
        '--ignore-gpu-blocklist'
    ],
  });

  const width = options.width || 1280;
  const height = options.height || 720;

  const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
  });

  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') console.error(`[Browser Error] ${msg.text()}`);
    else console.log(`[Browser] ${msg.text()}`);
  });

  page.on('pageerror', err => {
      console.error(`[Browser Page Error] ${err.message}`);
  });

  page.on('requestfailed', request => {
    console.error(`[Browser Request Failed] ${request.url()} - ${request.failure()?.errorText}`);
  });

  const fullUrl = `${clientUrl}?connect=${encodeURIComponent(serverUrl)}`;
  console.log(`Navigating to: ${fullUrl}`);

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    console.warn(`Failed to navigate to ${fullUrl}:`, error);
  }

  const client: TestClient = {
      browser,
      context,
      page,
      server: staticServer,
      navigate: async (url: string) => { await page.goto(url); },
      waitForGame: async () => {
          await page.waitForFunction(() => {
              return (window as any).game && (window as any).game.isRunning;
          }, undefined, { timeout: 10000 });
      },
      injectInput: async (type: string, data: any) => {
             await page.evaluate(({ type, data }: any) => {
                 const game = (window as any).game;
                 if (game && typeof game.injectInput === 'function') {
                     game.injectInput(type, data);
                 } else {
                     console.warn('Game instance or injectInput method not found on window');
                 }
             }, { type, data });
      },
      screenshot: async (name: string) => {
          return await page.screenshot({ path: `${name}.png` });
      },
      close: async () => {
          if (browser) await browser.close();
          if (staticServer) staticServer.close();
      }
  };

  return client;
}

export async function closeBrowser(client: TestClient): Promise<void> {
    await client.close();
}
