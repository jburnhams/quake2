import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { launchBrowserClient, closeBrowser, TestClient } from './helpers/testClient.js';
import { Browser, BrowserContext, Page, chromium } from 'playwright';

// Mock Playwright
vi.mock('playwright', () => {
  return {
    chromium: {
      launch: vi.fn(),
    },
  };
});

// Mock http createServer
vi.mock('http', () => {
  return {
    createServer: vi.fn(() => ({
      listen: vi.fn((port, cb) => cb && cb()),
      address: vi.fn(() => ({ port: 1234 })),
      close: vi.fn(),
    })),
  };
});

describe('testClient Helper', () => {
  let mockBrowser: Browser;
  let mockContext: BrowserContext;
  let mockPage: Page;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn(),
      on: vi.fn(),
    } as unknown as Page;

    mockContext = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as BrowserContext;

    mockBrowser = {
      newContext: vi.fn().mockResolvedValue(mockContext),
      close: vi.fn(),
    } as unknown as Browser;

    (chromium.launch as any).mockResolvedValue(mockBrowser);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should launch a browser and navigate to the client URL', async () => {
    const serverUrl = 'ws://localhost:27910';
    const clientUrl = 'http://localhost:3000';

    const client = await launchBrowserClient(serverUrl, { clientUrl, headless: false });

    expect(chromium.launch).toHaveBeenCalledWith(expect.objectContaining({
      headless: false,
      args: expect.arrayContaining(['--use-gl=egl']),
    }));

    expect(mockBrowser.newContext).toHaveBeenCalled();
    expect(mockContext.newPage).toHaveBeenCalled();

    const expectedUrl = `${clientUrl}?connect=${encodeURIComponent(serverUrl)}`;
    expect(mockPage.goto).toHaveBeenCalledWith(expectedUrl, { waitUntil: 'domcontentloaded' });

    expect(client.browser).toBe(mockBrowser);
    expect(client.page).toBe(mockPage);
  });

  it('should start a static server if clientUrl is not provided', async () => {
    const serverUrl = 'ws://localhost:27910';

    await launchBrowserClient(serverUrl);

    // Should use the port from the mocked http server (1234)
    const expectedUrlPrefix = 'http://localhost:1234/packages/e2e-tests/fixtures/real-client.html';
    expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining(expectedUrlPrefix), { waitUntil: 'domcontentloaded' });
  });

  it('should close the browser', async () => {
    const client: TestClient = {
      browser: mockBrowser,
      context: mockContext,
      page: mockPage,
    };

    await closeBrowser(client);

    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
