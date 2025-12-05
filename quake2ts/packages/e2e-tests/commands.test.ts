import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { launchBrowserClient, closeBrowser } from './helpers/testClient.js';
import { DedicatedServer } from '@quake2ts/server';
import { ConnectionState } from '@quake2ts/client'; // Assuming this is exported, otherwise use enum values

const GAME_SERVER_PORT_1 = 27912;
const GAME_SERVER_PORT_2 = 27913;

describe('E2E Command Flow Test', () => {
  // No static server needed, testClient helper handles it for real-client.html

  it('should send commands and receive updates', async () => {
    // Start server
    const server = await startTestServer(GAME_SERVER_PORT_1);

    // Launch client
    // Note: We don't provide clientUrl, so it defaults to serving the repo root and using real-client.html
    const { browser, page } = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_1}`, {
        headless: true
    });

    // Wait for connection to be established (Active state)
    // Increased timeout for slow environments
    await page.waitForFunction(() => {
        const client = (window as any).clientInstance;
        return client && client.multiplayer && client.multiplayer.isConnected();
    }, undefined, { timeout: 30000 });

    const status = await page.evaluate(() => {
        const client = (window as any).clientInstance;
        return client.multiplayer.state;
    });
    // Active = 5 (based on ConnectionState enum in client)
    expect(status).toBeGreaterThanOrEqual(4); // ConnectionState.Active

    // --- Test 4.4.1: Client sends commands ---
    // The harness loop in real-client.html already sends commands every frame via client.predict()

    // Verify outgoing sequence is increasing
    const initialSequence = await page.evaluate(() => {
        return (window as any).clientInstance.multiplayer.netchan.outgoingSequence;
    });

    // Wait for a few frames
    await page.waitForTimeout(1000);

    const newSequence = await page.evaluate(() => {
        return (window as any).clientInstance.multiplayer.netchan.outgoingSequence;
    });

    expect(newSequence).toBeGreaterThan(initialSequence);

    // --- Test 4.4.2: Server receives commands ---

    // Access server state directly (running in same process)
    // We need to find the connected client
    const serverClients = (server as any).svs.clients;
    const connectedClient = serverClients.find((c: any) => c && c.state >= 2); // 2 = Connected/Active

    expect(connectedClient).toBeDefined();

    // Verify server received commands
    // We expect lastCmd to be populated and sequence numbers to align
    expect(connectedClient.lastCmd).toBeDefined();

    // The client harness sends empty commands with msec=16
    expect(connectedClient.lastCmd.msec).toBe(16);

    await closeBrowser({ browser, page } as any);
    await stopServer(server);
  }, 40000);

  it('should handle command rate limiting', async () => {
    const server = await startTestServer(GAME_SERVER_PORT_2);
    const { browser, page } = await launchBrowserClient(`ws://localhost:${GAME_SERVER_PORT_2}`, {
        headless: true
    });

    // Wait for active
    await page.waitForFunction(() => {
        const client = (window as any).clientInstance;
        return client && client.multiplayer && client.multiplayer.isConnected();
    }, undefined, { timeout: 30000 });

    // --- Test 4.4.3: Command rate limiting ---

    // Flood commands from client
    await page.evaluate(() => {
        const client = (window as any).clientInstance;
        // Send 300 commands instantly
        for(let i=0; i<300; i++) {
             client.multiplayer.sendCommand({
                angles: {x:0, y:0, z:0},
                forwardmove: 0,
                sidemove: 0,
                upmove: 0,
                buttons: 0,
                impulse: 0,
                msec: 10,
                lightlevel: 0,
                serverFrame: 0
            });
        }
    });

    // Wait for server to process and kick
    await page.waitForTimeout(2000);

    // Verify client is disconnected
    // The client might not know it's disconnected immediately if the server just drops it without a packet,
    // but the WebSocket should close.
    // Or the server sends a disconnect packet.

    const isConnected = await page.evaluate(() => {
         const client = (window as any).clientInstance;
         return client.multiplayer.isConnected();
    });

    // Server logic: `this.dropClient(client)` calls `client.net.disconnect()`.
    // This should close the socket.

    // However, depending on timing, it might still be in 'Active' state on client if the close event hasn't fired yet
    // or if the server just stopped processing but didn't close socket (unlikely with dropClient).

    // Let's verify on server side first
    const serverClients = (server as any).svs.clients;
    // The client slot should be null or Free (0)
    // Or if it's still there, it should be marked as dropped?
    // In DedicatedServer.dropClient, it sets state to Free via onClose callback mostly.

    // Note: The websocket close might take a moment to propagate.

    // Check if any client is still Active (4)
    const activeClients = serverClients.filter((c: any) => c && c.state === 4);
    expect(activeClients.length).toBe(0);

    await closeBrowser({ browser, page } as any);
    await stopServer(server);
  }, 40000);
});
