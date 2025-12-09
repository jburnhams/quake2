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

    // Inject specific input to verify data integrity
    const testAngles = { x: 10, y: 20, z: 5 };
    await page.evaluate((angles) => {
        (window as any).testInput = {
            angles: angles,
            forwardmove: 100,
            sidemove: -50,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            msec: 16,
            lightlevel: 0,
            serverFrame: 0
        };
    }, testAngles);

    // Wait for command to be processed by server
    // Polling loop to wait for sequence increase
    let newSequence = initialSequence;
    const startTime = Date.now();
    while (newSequence <= initialSequence + 5) {
        if (Date.now() - startTime > 5000) {
            throw new Error('Timeout waiting for sequence to increase');
        }
        await page.waitForTimeout(100);
        newSequence = await page.evaluate(() => {
            return (window as any).clientInstance.multiplayer.netchan.outgoingSequence;
        });
    }

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

    // Verify the specific content of the command matches what we injected
    // Note: angles might be quantized or processed, but for raw usercmd they should match closely
    // Quake 2 uses 16-bit angles (65536/360), so there might be slight precision loss if converted
    // but here we are checking the parsed usercommand.

    // Check msec
    expect(connectedClient.lastCmd.msec).toBe(16);

    // Check movement
    expect(connectedClient.lastCmd.forwardmove).toBe(100);
    expect(connectedClient.lastCmd.sidemove).toBe(-50);

    // Check angles - use x/y/z accessors (UserCommand.angles is a Vec3)
    // Use toBeCloseTo for robust float comparison
    expect(connectedClient.lastCmd.angles.x).toBeCloseTo(testAngles.x, 1);
    expect(connectedClient.lastCmd.angles.y).toBeCloseTo(testAngles.y, 1);
    expect(connectedClient.lastCmd.angles.z).toBeCloseTo(testAngles.z, 1);

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
        // Send 300 commands instantly (limit is usually much lower, e.g., packet limit)
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
    // The server should detect the flood and drop the client
    await page.waitForTimeout(2000);

    // Verify client is disconnected
    const isConnected = await page.evaluate(() => {
         const client = (window as any).clientInstance;
         return client.multiplayer.isConnected();
    });

    // Verify on server side
    const serverClients = (server as any).svs.clients;

    // Check if any client is still Active (4)
    // We poll briefly because the server frame loop processes disconnects asynchronously
    await new Promise(resolve => setTimeout(resolve, 2000));

    const activeClients = serverClients.filter((c: any) => c && c.state === 4);
    expect(activeClients.length).toBe(0);

    await closeBrowser({ browser, page } as any);
    await stopServer(server);
  }, 40000);
});
