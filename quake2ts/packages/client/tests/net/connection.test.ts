import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiplayerConnection, ConnectionState } from '../../src/net/connection';
import { NetDriver, UserCommand, ClientCommand, ServerCommand, BinaryWriter } from '@quake2ts/shared';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver';

// Mock dependencies
vi.mock('../../src/net/browserWsDriver', () => {
    return {
        BrowserWebSocketNetDriver: vi.fn().mockImplementation(() => ({
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn(),
            send: vi.fn(),
            onMessage: vi.fn(),
            onClose: vi.fn(),
            onError: vi.fn()
        }))
    };
});

describe('MultiplayerConnection', () => {
    let connection: MultiplayerConnection;
    let mockDriver: any;

    const mockCmd: UserCommand = {
        msec: 100,
        buttons: 0,
        angles: { x: 0, y: 0, z: 0 },
        forwardmove: 0,
        sidemove: 0,
        upmove: 0,
        serverFrame: 0
    };

    beforeEach(() => {
        connection = new MultiplayerConnection({
            username: 'Player',
            model: 'male',
            skin: 'grunt'
        });
        mockDriver = (connection as any).driver;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize in disconnected state', () => {
        expect(connection.isConnected()).toBe(false);
    });

    it('should transition to Connecting and then Challenge state on connect', async () => {
        await connection.connect('ws://localhost:27910');
        expect(mockDriver.connect).toHaveBeenCalledWith('ws://localhost:27910');
        expect((connection as any).state).toBe(ConnectionState.Challenge);
        // Verify it sends getchallenge
        expect(mockDriver.send).toHaveBeenCalled();
    });

    it('should complete handshake sequence', async () => {
        await connection.connect('ws://localhost:27910');

        // Simulate "challenge 12345" response
        const writer = new BinaryWriter();
        writer.writeLong(0); // Sequence
        writer.writeLong(0); // Ack
        writer.writeByte(ServerCommand.stufftext);
        writer.writeString('challenge 12345\n');

        // Trigger onMessage
        const onMessage = mockDriver.onMessage.mock.calls[0][0];
        onMessage(new Uint8Array(writer.getData()));

        // Should have sent connect command
        expect(mockDriver.send).toHaveBeenCalledTimes(2); // getchallenge + connect

        // Simulate svc_serverdata
        const writer2 = new BinaryWriter();
        writer2.writeLong(1);
        writer2.writeLong(0);
        writer2.writeByte(ServerCommand.serverdata);
        writer2.writeLong(34); // Protocol
        writer2.writeLong(1); // Server count
        writer2.writeByte(0); // Attract
        writer2.writeString("baseq2");
        writer2.writeShort(0); // Player num
        writer2.writeString("maps/test.bsp");

        onMessage(new Uint8Array(writer2.getData()));
        expect((connection as any).state).toBe(ConnectionState.Loading);

        // Simulate "precache" which finishes loading
        const writer3 = new BinaryWriter();
        writer3.writeLong(2);
        writer3.writeLong(0);
        writer3.writeByte(ServerCommand.stufftext);
        writer3.writeString('precache\n');

        onMessage(new Uint8Array(writer3.getData()));

        expect(connection.isConnected()).toBe(true);
        expect((connection as any).state).toBe(ConnectionState.Active);
    });

    it('should buffer last 64 commands', async () => {
        // Manually set state to Active to allow sending
        (connection as any).state = ConnectionState.Active;

        // Send 70 commands
        for (let i = 0; i < 70; i++) {
            connection.sendCommand({ ...mockCmd, serverFrame: i });
        }

        const cmdBuffer = (connection as any).commandHistory as UserCommand[];
        expect(cmdBuffer).toBeDefined();
        expect(cmdBuffer.length).toBe(64);
        expect(cmdBuffer[0].serverFrame).toBe(6); // Should drop first 6
        expect(cmdBuffer[63].serverFrame).toBe(69);
    });

    it('should attach serverFrame to sent commands if available', async () => {
        // Mock server frame update
        (connection as any).latestServerFrame = 123;
        (connection as any).state = ConnectionState.Active;

        connection.sendCommand({ ...mockCmd, serverFrame: undefined });

        const cmdBuffer = (connection as any).commandHistory as UserCommand[];
        expect(cmdBuffer[0].serverFrame).toBe(123);
    });
});
