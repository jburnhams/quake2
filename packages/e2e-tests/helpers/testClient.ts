import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import handler from 'serve-handler';
import path from 'path';
import { fileURLToPath } from 'url';
import { PlaywrightTestClient } from '@quake2ts/test-utils-browser';

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
  queryParams?: Record<string, string>;
}

export interface TestClient extends PlaywrightTestClient {
    context: BrowserContext;
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
    // __dirname is packages/e2e-tests/helpers
    const repoRoot = path.resolve(__dirname, '../../..');

    staticServer = createServer((request: IncomingMessage, response: ServerResponse) => {
      return handler(request, response, {
        public: repoRoot,
        cleanUrls: false, // Ensure we don't redirect .html -> extensionless which might drop query params
        headers: [
          {
            source: '**/*',
            headers: [
              {
                key: 'Cache-Control',
                value: 'no-cache'
              },
              {
                key: 'Access-Control-Allow-Origin',
                value: '*'
              },
              {
                key: 'Cross-Origin-Opener-Policy',
                value: 'same-origin'
              },
              {
                key: 'Cross-Origin-Embedder-Policy',
                value: 'require-corp'
              }
            ]
          }
        ]
      });
    });

    await new Promise<void>((resolve) => {
        staticServer.listen(0, () => {
            const addr = staticServer.address();
            const port = typeof addr === 'object' ? addr?.port : 0;
            // Point to the fixture
            clientUrl = `http://localhost:${port}/packages/e2e-tests/fixtures/real-client.html`;
            console.log(`Test client serving from ${repoRoot} at ${clientUrl}`);
            resolve();
        });
    });
  }

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    args: [
        '--use-gl=egl', // Ensure WebGL support in headless environments
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

  // Inject console logging to stdout for debugging
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

  // Navigate to the client application
  const query = new URLSearchParams();
  query.set('connect', serverUrl);
  if (options.queryParams) {
      for (const [key, value] of Object.entries(options.queryParams)) {
          query.set(key, value);
      }
  }
  const fullUrl = `${clientUrl}?${query.toString()}`;
  console.log(`Navigating to: ${fullUrl}`);

  try {
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  } catch (error) {
    console.warn(`Failed to navigate to ${fullUrl}:`, error);
  }

  // Construct the client object matching PlaywrightTestClient interface
  const client: TestClient = {
      browser,
      context,
      page,
      server: staticServer,
      navigate: async (url: string) => { await page.goto(url); },
      waitForGame: async () => {
          await page.waitForFunction(() => {
              // Check for global game instance and running state
              return (window as any).game && (window as any).game.isRunning;
          }, { timeout: 10000 });
      },
      injectInput: async (type: string, data: any) => {
             await page.evaluate(({ type, data }: any) => {
                 // Forward input event to the game instance if available
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
          await closeBrowser(client);
      }
  };

  return client;
}

/**
 * Closes the browser instance.
 *
 * @param client - The TestClient object returned by launchBrowserClient
 */
export async function closeBrowser(client: TestClient): Promise<void> {
  if (client.browser) {
    await client.browser.close();
  }
  if (client.server) {
      client.server.close();
  }
}
