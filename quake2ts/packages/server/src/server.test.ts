import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer, createServer, ServerOptions } from './dedicated.js';
import { NetworkTransport } from './transport.js';
import { NetDriver } from '@quake2ts/shared';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn().mockResolvedValue(Buffer.alloc(100))
    }
}));

vi.mock('@quake2ts/engine', () => ({
    parseBsp: vi.fn().mockReturnValue({
        planes: [],
        nodes: [],
        leafs: [],
        brushes: [],
        models: [],
        leafLists: { leafBrushes: [] },
        texInfo: [],
        brushSides: [],
        visibility: { numClusters: 0, clusters: [] } // Add visibility to mock
    })
}));

// Mock Transport
class MockTransport implements NetworkTransport {
    public onConnectionCallback?: (driver: NetDriver, info?: any) => void;
    public onErrorCallback?: (error: Error) => void;

    async listen(port: number): Promise<void> {
        return Promise.resolve();
    }

    close() {}

    onConnection(callback: (driver: NetDriver, info?: any) => void) {
        this.onConnectionCallback = callback;
    }

    onError(callback: (error: Error) => void) {
        this.onErrorCallback = callback;
    }
}

describe('DedicatedServer', () => {
    let server: DedicatedServer;
    let transport: MockTransport;

    beforeEach(() => {
        transport = new MockTransport();
    });

    afterEach(() => {
        if (server) {
            server.stopServer();
        }
    });

    it('should create a server with default options', () => {
        server = createServer({ transport });
        expect(server).toBeInstanceOf(DedicatedServer);
    });

    it('should start and stop with custom transport', async () => {
        server = createServer({ transport });
        await expect(server.startServer('maps/test.bsp')).resolves.not.toThrow();
        server.stopServer();
    });

    it('should fail to start without map', async () => {
        server = createServer({ transport });
        await expect(server.startServer()).rejects.toThrow('No map specified');
    });

    it('should kick player', () => {
        server = createServer({ transport });
        // Just verify method exists and runs safely on empty server
        expect(() => server.kickPlayer(0)).not.toThrow();
    });

    it('should change map', async () => {
        server = createServer({ transport });
        await server.startServer('maps/q2dm1.bsp');
        await expect(server.changeMap('maps/q2dm2.bsp')).resolves.not.toThrow();
    });
});
