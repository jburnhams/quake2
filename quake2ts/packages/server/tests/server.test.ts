import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import { MockTransport } from './mocks/transport.js';

// Mock fs to avoid ENOENT errors
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn().mockRejectedValue(new Error('Mocked ENOENT'))
    }
}));

describe('DedicatedServer', () => {
    let server: DedicatedServer;
    let transport: MockTransport;
    let consoleWarnSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        transport = new MockTransport();
        server = new DedicatedServer({ port: 27910, transport });

        // Suppress expected console warnings and logs
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
        server.stopServer();
    });

    it('should initialize WebSocketServer on start', async () => {
        await server.startServer('test_map');
        expect(transport.listenSpy).toHaveBeenCalledWith(27910);

        // Verify we got the expected warning
        expect(console.warn).toHaveBeenCalledWith('Failed to load map:', expect.any(Error));
    });

    it('should be able to stop', async () => {
        await server.startServer('test_map');
        server.stopServer();
        expect(transport.closeSpy).toHaveBeenCalled();
    });
});
