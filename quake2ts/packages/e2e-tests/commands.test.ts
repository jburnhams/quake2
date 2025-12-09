import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { launchBrowserClient, closeBrowser, TestClient } from './helpers/testClient.js';
import { DedicatedServer } from '@quake2ts/server';
import { createServer } from 'http';
import handler from 'serve-handler';
import path from 'path';
import { fileURLToPath } from 'url';

const CLIENT_PORT = 8082;
const GAME_SERVER_PORT_1 = 27912;
const GAME_SERVER_PORT_2 = 27913;

// Fix for ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('E2E Command Flow Test', () => {
  let staticServer: any;

  beforeAll(async () => {
      // 1. Start static file server to serve the fixture
      const fixturePath = path.resolve(__dirname, 'fixtures');

      staticServer = createServer((request, response) => {
          return handler(request, response, {
              public: fixturePath,
              rewrites: [
                { source: '/', destination: '/client.html' }
              ]
          });
      });

      await new Promise<void>((resolve) => {
          staticServer.listen(CLIENT_PORT, () => resolve());
      });
  });

  afterAll(() => {
      if (staticServer) staticServer.close();
  });

  it.skip('should send commands and receive updates', async () => {
    // Start server
    const server = await startTestServer(GAME_SERVER_PORT_1);

    // Launch client
    const { browser, page } = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_1}`, {
        clientUrl: `http://localhost:${CLIENT_PORT}/`,
        headless: true
    });

    // Wait for connection to be established
    await page.waitForSelector('#status');
    const status = await page.textContent('#status');
    expect(status).toBe('Connected');

    // Simulate player movement (command generation)
    // The dummy client in client.html automatically sends commands if connected.
    // We can check the sequence numbers in the client instance if we expose them.

    // Since our dummy client is minimal, we need to inspect what it sends.
    // The dummy client exposes `window.client` or similar?
    // Wait, the dummy client in fixtures/client.html is very simple and doesn't expose quake2 object same as real client.
    // BUT connection.test.ts uses a simple client.html that uses `MultiplayerConnection`.

    // Let's assume we are testing the REAL client code (bundled) if possible,
    // OR we are using the minimal test client which should expose `connection`.

    // Let's inspect the `window.connection` which the fixture sets up.

    const commandsSent = await page.evaluate(async () => {
        const conn = (window as any).connection;
        if (!conn) return 0;
        const startSeq = conn.netchan ? conn.netchan.outgoingSequence : 0;

        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000));

        const endSeq = conn.netchan ? conn.netchan.outgoingSequence : 0;
        return endSeq - startSeq;
    });

    // The dummy client sends 1 command per frame (simulated loop in client.html)
    expect(commandsSent).toBeGreaterThan(0);

    await closeBrowser(browser);
    await stopServer(server);
  });

  it.skip('should handle command rate limiting', async () => {
    const server = await startTestServer(GAME_SERVER_PORT_2);
    const { browser, page } = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_2}`, {
        clientUrl: `http://localhost:${CLIENT_PORT}/`,
        headless: true
    });

    await page.waitForSelector('#status');

    // Flood commands
    await page.evaluate(() => {
        const conn = (window as any).connection;
        // Spam 100 commands instantly
        for(let i=0; i<100; i++) {
            conn.sendCommand({
                angles: {x:0, y:0, z:0},
                forwardmove: 0,
                sidemove: 0,
                upmove: 0,
                buttons: 0,
                impulse: 0,
                msec: 10,
                lightlevel: 0
            });
        }
    });

    // Verify we are not disconnected immediately (rate limit warning, but not flood kick yet)
    // Flood kick threshold is >200.

    const isConnected = await page.evaluate(() => {
         const conn = (window as any).connection;
         return conn.isConnected();
    });
    expect(isConnected).toBe(true);

    // Now try to trigger flood kick (>200)
    await page.evaluate(() => {
        const conn = (window as any).connection;
        // Flood - sending 300 commands
        for(let i=0; i<300; i++) {
             conn.sendCommand({
                angles: {x:0, y:0, z:0},
                forwardmove: 0,
                sidemove: 0,
                upmove: 0,
                buttons: 0,
                impulse: 0,
                msec: 10,
                lightlevel: 0
            });
        }
    });

    // Wait for server to process and kick.
    // The disconnect happens asynchronously.
    // Wait for the status element to change to 'Disconnected'

    try {
        // The waitForFunction fails if flood kick takes time.
        // Let's verify that we eventually disconnect.
        await page.waitForFunction(() => {
             const conn = (window as any).connection;
             return !conn.isConnected();
        }, undefined, { timeout: 5000 });
    } catch (e) {
        console.log('Timeout waiting for disconnect, checking status manually');
    }

    const isConnectedAfterFlood = await page.evaluate(() => {
         const conn = (window as any).connection;
         return conn.isConnected();
    });

    // Should be disconnected
    expect(isConnectedAfterFlood).toBe(false);

    await closeBrowser(browser);
    await stopServer(server);
  }, 20000);
});
