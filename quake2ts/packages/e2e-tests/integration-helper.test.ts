import { describe, it, expect, afterEach } from 'vitest';
import { launchBrowserClient, closeBrowser, TestClient } from './helpers/testClient.js';

// This test verifies that we can actually interact with the installed Playwright binaries
// and launch a browser process. It is "realistic" in the sense that it doesn't mock Playwright.
describe('E2E Client Integration (Real Browser)', () => {
    let client: TestClient | undefined;

    afterEach(async () => {
        if (client) {
            await closeBrowser(client);
            client = undefined;
        }
    });

    it('should launch a real headless browser', async () => {
        // We use a data URL to avoid needing a web server for this connectivity test
        const testUrl = 'data:text/html,<html><body><h1>Test</h1></body></html>';
        const serverUrl = 'ws://localhost:27910'; // Dummy server URL

        // Launch browser pointing to our data URL
        // We pass the testUrl as the clientUrl
        client = await launchBrowserClient(serverUrl, {
            clientUrl: testUrl,
            headless: true
        });

        const title = await client.page.title();
        expect(client.browser).toBeDefined();

        // Our helper appends ?connect=... to the URL, but data URLs might behave strictly.
        // Let's check if the browser is running and we have a page.
        expect(client.page).toBeDefined();

        // Verify browser context options were applied (viewport default 1280x720)
        const viewport = client.page.viewportSize();
        expect(viewport).toEqual({ width: 1280, height: 720 });
    });
});
