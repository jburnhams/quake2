import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer, createServer } from '../../src/dedicated.js';
import { createMockTransport, MockTransport, createTestBspMap } from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn().mockResolvedValue(Buffer.alloc(100))
    }
}));

import { parseBsp } from '@quake2ts/engine';

vi.mock('@quake2ts/engine', () => ({
    parseBsp: vi.fn()
}));

describe('DedicatedServer', () => {
    let server: DedicatedServer;
    let transport: MockTransport;
    let consoleWarnSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(parseBsp).mockReturnValue(createTestBspMap());

        transport = createMockTransport();
        server = new DedicatedServer({ port: 27910, transport });

        // Suppress expected console warnings and logs
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        if (server) {
            server.stopServer();
        }
    });

    it('should create a server with default options', () => {
        server = createServer({ transport });
        expect(server).toBeInstanceOf(DedicatedServer);
    });

    it('should initialize WebSocketServer on start', async () => {
        await server.startServer('test_map');
        expect(transport.listenSpy).toHaveBeenCalledWith(27910);
    });

    it('should be able to stop', async () => {
        await server.startServer('test_map');
        server.stopServer();
        expect(transport.closeSpy).toHaveBeenCalled();
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
