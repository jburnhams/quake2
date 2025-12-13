import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import { WebSocketNetDriver } from '../src/net/nodeWsDriver.js';
import { WebSocketServer } from 'ws';

// Mock dependencies
vi.mock('ws', () => {
    return {
        WebSocketServer: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn(),
        })),
        default: vi.fn() // WebSocket client mock if needed
    };
});

vi.mock('../src/net/nodeWsDriver.js', () => ({
    WebSocketNetDriver: vi.fn().mockImplementation(() => ({
        attach: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        send: vi.fn(),
        disconnect: vi.fn()
    }))
}));

// Mock fs to avoid ENOENT errors
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn().mockRejectedValue(new Error('Mocked ENOENT'))
    }
}));

describe('DedicatedServer', () => {
    let server: DedicatedServer;
    let consoleWarnSpy: any;
    let consoleLogSpy: any;

    beforeEach(() => {
        vi.clearAllMocks();
        server = new DedicatedServer(27910);
        // Suppress expected console warnings and logs
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    it('should initialize WebSocketServer on start', async () => {
        await server.start('test_map');
        expect(WebSocketServer).toHaveBeenCalledWith({ port: 27910 });

        // Verify we got the expected warning
        expect(console.warn).toHaveBeenCalledWith('Failed to load map:', expect.any(Error));

        server.stop();
    });

    it('should be able to stop', async () => {
        await server.start('test_map');
        const wssMock = (WebSocketServer as unknown as any).mock.results[0].value;
        server.stop();
        expect(wssMock.close).toHaveBeenCalled();
    });
});
