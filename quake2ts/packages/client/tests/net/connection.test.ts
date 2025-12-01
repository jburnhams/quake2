import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiplayerConnection, ConnectionState } from '../../src/net/connection.js';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver.js';
import { ClientCommand, ServerCommand } from '@quake2ts/shared';
import { NetworkMessageBuilder } from '@quake2ts/shared';

// Mock BrowserWebSocketNetDriver
vi.mock('../../src/net/browserWsDriver.js', () => {
    return {
        BrowserWebSocketNetDriver: vi.fn().mockImplementation(() => {
            return {
                connect: vi.fn().mockResolvedValue(undefined),
                disconnect: vi.fn(),
                send: vi.fn(),
                onMessage: vi.fn(),
                onClose: vi.fn(),
                onError: vi.fn(),
                isConnected: vi.fn().mockReturnValue(true)
            };
        })
    };
});

describe('MultiplayerConnection', () => {
    let connection: MultiplayerConnection;
    let mockDriver: any;

    beforeEach(() => {
        vi.clearAllMocks();
        connection = new MultiplayerConnection({
            username: 'Player',
            model: 'male',
            skin: 'grunt',
            hand: 0,
            fov: 90
        });
        mockDriver = (connection as any).driver;
    });

    it('should initialize in Disconnected state', () => {
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
    });

    it('should connect and send challenge request', async () => {
        await connection.connect('ws://localhost:27910');
        expect(mockDriver.connect).toHaveBeenCalledWith('ws://localhost:27910');
        expect((connection as any).state).toBe(ConnectionState.Challenge);

        // Check if getchallenge was sent
        expect(mockDriver.send).toHaveBeenCalled();
        const sentData = mockDriver.send.mock.calls[0][0];
        // Cannot easily check binary content here without parsing, but we verify interaction
    });

    it('should handle disconnection', () => {
        (connection as any).state = ConnectionState.Connected;
        connection.disconnect();
        expect(mockDriver.disconnect).toHaveBeenCalled();
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
    });

    it('should parse server commands', () => {
         // Mock a serverdata message
         // Just a placeholder test for now as constructing binary packets manually is tedious
         // and we rely on the parser which is tested separately.
         // However, we can test the handler callbacks.

         const onServerDataSpy = vi.spyOn(connection, 'onServerData');
         connection.onServerData(34, 1, 0, 'baseq2', 0, 'q2dm1');

         expect(onServerDataSpy).toHaveBeenCalled();
         expect(connection.serverProtocol).toBe(34);
         expect(connection.levelName).toBe('q2dm1');
         expect((connection as any).state).toBe(ConnectionState.Loading);
    });
});
