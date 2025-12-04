import { chromium, Browser, Page, BrowserContext } from 'playwright';

/**
 * Interface for Test Client options
 */
export interface TestClientOptions {
  headless?: boolean;
  clientUrl?: string; // URL where the web client is hosted
  width?: number;
  height?: number;
}

export interface TestClient {
    browser: Browser;
    context: BrowserContext;
    page: Page;
}

/**
 * Launches a browser instance and loads the game client.
 *
 * @param serverUrl - The address of the game server to connect to (e.g., "ws://localhost:27910")
 * @param options - Configuration options for the browser client
 * @returns Object containing browser, context, and page instances
 */
export async function launchBrowserClient(serverUrl: string, options: TestClientOptions = {}): Promise<TestClient> {
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

  // Default to a local dev server if not specified.
  // In a real CI pipeline, this would point to the served build artifact.
  const url = options.clientUrl || 'http://localhost:8080';

  // Navigate to the client application
  // We append the server address as a query parameter if the client supports auto-connect via URL
  // e.g. http://localhost:8080/?connect=ws://localhost:27910
  const fullUrl = `${url}?connect=${encodeURIComponent(serverUrl)}`;

  try {
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
  } catch (error) {
    // If navigation fails (e.g. server not running), we still return the page
    // but log a warning, allowing the test to potentially assert on the failure.
    console.warn(`Failed to navigate to ${fullUrl}:`, error);
  }

  return { browser, context, page };
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
}
