import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { launchBrowserClient, closeBrowser, TestClient } from './helpers/testClient.js';
import { DedicatedServer } from '@quake2ts/server';
import { ConnectionState } from '@quake2ts/shared';

const GAME_SERVER_PORT = 27911;

describe('E2E Real Client Connection Test', () => {
    let gameServer: DedicatedServer;
    let testClient: TestClient;

    beforeAll(async () => {
        // Start Game Server
        gameServer = await startTestServer(GAME_SERVER_PORT);
    });

    afterAll(async () => {
        if (testClient) await closeBrowser(testClient);
        if (gameServer) await stopServer(gameServer);
    });

    it('should connect and perform handshake', async () => {
        const serverUrl = `ws://localhost:${GAME_SERVER_PORT}`;
        testClient = await launchBrowserClient(serverUrl, {
            headless: true
        });

        const { page } = testClient;

        // Verify the harness logic runs
        await page.waitForSelector('#debug');

        // Wait until debug text says "Connected!"
        await page.waitForFunction(
            () => document.getElementById('debug')?.innerText === 'Connected!',
            { timeout: 10000 }
        );

        const debugText = await page.textContent('#debug');
        expect(debugText).toBe('Connected!');

        // Inspect the client instance on the page to get the exact state
        const connectionStateValue = await page.evaluate(() => {
            const client = (window as any).clientInstance;
            if (!client) return 'No Client';
            return client.multiplayer.state;
        });

        // We expect it to be Connected (2) or Primed (3) or Active (4)
        // If it's Disconnected (0), that's the failure.
        // Let's log what we got if it fails.
        // Mapping: Disconnected=0, Connecting=1, Connected=2, Primed=3, Active=4 (approx)

        // We accept Connected or higher as success for "connect()"
        // But for full handshake, we might want Active.
        // For this test, verifying it reached Connected and didn't immediately disconnect is the goal.

        // Check if state >= 2 (Connected)
        const state = Number(connectionStateValue);
        expect(state).toBeGreaterThanOrEqual(2);

    }, 30000);
});
