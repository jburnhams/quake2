import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('DedicatedServer', () => {
    let server: DedicatedServer;

    beforeEach(() => {
        server = new DedicatedServer(27910);
    });

    it('should initialize WebSocketServer on start', async () => {
        await server.start('test_map');
        expect(WebSocketServer).toHaveBeenCalledWith({ port: 27910 });
        server.stop();
    });

    it('should be able to stop', async () => {
        await server.start('test_map');
        const wssMock = (WebSocketServer as unknown as any).mock.results[0].value;
        server.stop();
        expect(wssMock.close).toHaveBeenCalled();
    });
});
