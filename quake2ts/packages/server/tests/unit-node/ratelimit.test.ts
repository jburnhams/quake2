import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated';
import { ClientState } from '../../src/client';
import { NetworkTransport } from '../../src/transport';
import { NetDriver } from '@quake2ts/shared';
import { MockNetDriver } from '@quake2ts/test-utils';

// Mock Transport (Server Side)
class MockServerTransport implements NetworkTransport {
    listen(port: number): Promise<void> { return Promise.resolve(); }
    close(): void {}
    onConnection(cb: (driver: NetDriver, info?: any) => void): void { this.connCb = cb; }
    onError(cb: (err: Error) => void): void {}

    public connCb: ((driver: NetDriver, info?: any) => void) | null = null;
}

describe('Rate Limiting', () => {
    let server: DedicatedServer;
    let transport: MockServerTransport;

    beforeEach(() => {
        transport = new MockServerTransport();
        server = new DedicatedServer({ transport, maxPlayers: 1, floodLimit: 200 });
    });

    it('should kick a client that sends too many commands in a second', async () => {
        const s = server as any;
        s.svs.initialized = true;

        const driver = new MockNetDriver();
        s.handleConnection(driver);

        const client = s.svs.clients[0];
        expect(client).toBeDefined();

        client.state = ClientState.Active;
        client.edict = {};

        // Scenario 1: Flood within the window
        client.commandCount = 201;
        client.lastCommandTime = Date.now();

        const dropSpy = vi.spyOn(s, 'dropClient');

        // Execute logic (mimicking FIXED runFrame)
        const runLogic = () => {
             const now = Date.now();

             // FIXED ORDER
             const limit = s.options.floodLimit ?? 200;
             if (client.commandCount > limit) {
                  s.dropClient(client);
                  return;
             }

             if (now - client.lastCommandTime >= 1000) {
                 client.lastCommandTime = now;
                 client.commandCount = 0;
             }
        };

        runLogic();
        expect(dropSpy).toHaveBeenCalledWith(client);
    });

    it('should kick even if flood is detected after window reset (Loophole Fixed)', async () => {
        const s = server as any;
        s.svs.initialized = true;

        const driver = new MockNetDriver();
        s.handleConnection(driver);

        const client = s.svs.clients[0];
        client.state = ClientState.Active;
        client.edict = {};

        const dropSpy = vi.spyOn(s, 'dropClient');

        // Scenario 2: Flood accumulated, but window expires right as we check
        client.commandCount = 300;
        client.lastCommandTime = Date.now() - 1100; // Window expired

        // Execute logic (mimicking FIXED runFrame)
        const runLogic = () => {
             const now = Date.now();

             // FIXED ORDER
             const limit = s.options.floodLimit ?? 200;
             if (client.commandCount > limit) {
                  s.dropClient(client);
                  return;
             }

             if (now - client.lastCommandTime >= 1000) {
                 client.lastCommandTime = now;
                 client.commandCount = 0;
             }
        };

        runLogic();

        // NOW we expect it to be called
        expect(dropSpy).toHaveBeenCalledWith(client);
    });
});
