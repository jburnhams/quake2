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

        // We can inspect the client instance on the page
        const connectionState = await page.evaluate(() => {
            const client = (window as any).clientInstance;
            if (!client) return 'No Client';
            // return client.multiplayer.state; // Need to map enum to string or check value
            return client.multiplayer.isConnected() ? 'Connected' : 'Disconnected';
        });

        expect(connectionState).toBe('Connected');

    }, 30000);
});
