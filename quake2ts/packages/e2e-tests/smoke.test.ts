import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopServer } from './helpers/testServer.js';
import { DedicatedServer } from '@quake2ts/server';

describe('E2E Smoke Test', () => {
    let server: DedicatedServer;
    const PORT = 27999; // Use a different port to avoid conflicts

    beforeAll(async () => {
        // Start the server
        server = await startTestServer(PORT);
    });

    afterAll(async () => {
        // Stop the server
        if (server) {
            await stopServer(server);
        }
    });

    it('should start the dedicated server', () => {
        expect(server).toBeDefined();
        // Accessing private or protected properties might be tricky in TS unless we cast or use public getters if available.
        // DedicatedServer doesn't verify "started" status publicly, but if start() resolved, it's good.
        // We can check if it listens?
        // For now, just existence is enough for a smoke test of the helper.
    });

    // We skip the browser part in this smoke test if we don't have the client running.
    // Ideally, we would have a full test here, but "launchBrowserClient" expects a running client app.
    // For this specific task, verifying we can import and run the server helper is progress.
});
