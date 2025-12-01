
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { MultiplayerConnection, ConnectionState } from '../../src/net/connection.js';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver.js';
import { ClientCommand, ServerCommand, NetworkMessageBuilder, BinaryStream, UserCommand, PlayerButton } from '@quake2ts/shared';

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
                isConnected: vi.fn().mockReturnValue(false)
            };
        })
    };
});

describe('MultiplayerConnection', () => {
    let connection: MultiplayerConnection;
    let mockDriver: any;

    const options = {
        username: 'Player',
        model: 'male',
        skin: 'grunt',
        hand: 0,
        fov: 90
    };

    beforeEach(() => {
        connection = new MultiplayerConnection(options);
        // Get the mock instance from the constructor call
        mockDriver = (connection as any).driver;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should initiate connection and send getchallenge', async () => {
        await connection.connect('ws://localhost:27910');

        expect(mockDriver.connect).toHaveBeenCalledWith('ws://localhost:27910');
        expect(mockDriver.send).toHaveBeenCalled();

        const call = mockDriver.send.mock.calls[0];
        const sentData = call[0];
        const stream = new BinaryStream(sentData.buffer);

        expect(stream.readByte()).toBe(ClientCommand.stringcmd);
        expect(stream.readString()).toBe('getchallenge');
    });

    it('should handle challenge response and send connect', async () => {
        await connection.connect('ws://localhost:27910');

        // Simulate server response: stufftext "challenge 12345"
        // This simulates standard Quake 2 handshake flow over WebSocket stream.

        const msgBuilder = new NetworkMessageBuilder();
        msgBuilder.writeLong(0); // seq
        msgBuilder.writeLong(0); // ack
        msgBuilder.writeByte(ServerCommand.stufftext);
        msgBuilder.writeString("challenge 12345");

        // Invoke callback
        const onMessage = (mockDriver.onMessage as Mock).mock.calls[0][0];
        onMessage(msgBuilder.getData());

        expect(mockDriver.send).toHaveBeenCalledTimes(2); // 1. getchallenge, 2. connect

        const connectCall = mockDriver.send.mock.calls[1][0];
        const connectStream = new BinaryStream(connectCall.buffer);
        expect(connectStream.readByte()).toBe(ClientCommand.stringcmd);
        const connectStr = connectStream.readString();
        expect(connectStr).toContain('connect');
        expect(connectStr).toContain('12345');
        expect(connectStr).toContain('Player');
    });

    it('should handle serverdata and transition to loading', async () => {
        // Setup state to expecting serverdata
        await connection.connect('ws://localhost:27910');
        (connection as any).state = ConnectionState.Challenge;

        const msgBuilder = new NetworkMessageBuilder();
        msgBuilder.writeLong(0); // seq
        msgBuilder.writeLong(0); // ack

        // ServerCommand.serverdata = 12
        msgBuilder.writeByte(ServerCommand.serverdata);
        msgBuilder.writeLong(34); // Protocol 34 (Vanilla)
        msgBuilder.writeLong(1); // Server count
        msgBuilder.writeByte(0); // Attract/Demo
        msgBuilder.writeString("baseq2"); // GameDir
        msgBuilder.writeShort(0); // PlayerNum
        msgBuilder.writeString("q2dm1"); // LevelName

        const onMessage = (mockDriver.onMessage as Mock).mock.calls[0][0];
        onMessage(msgBuilder.getData());

        expect((connection as any).state).toBe(ConnectionState.Loading);
        expect(connection.serverProtocol).toBe(34);
        expect(connection.levelName).toBe('q2dm1');

        // Should send "new" command
        expect(mockDriver.send).toHaveBeenCalled();
        const lastCall = mockDriver.send.mock.lastCall[0];
        const stream = new BinaryStream(lastCall.buffer);
        expect(stream.readByte()).toBe(ClientCommand.stringcmd);
        expect(stream.readString()).toBe('new');
    });

    it('should finish loading on "precache" stufftext', async () => {
        // Setup state
        await connection.connect('ws://localhost:27910');
        (connection as any).state = ConnectionState.Loading;

        const msgBuilder = new NetworkMessageBuilder();
        msgBuilder.writeLong(0);
        msgBuilder.writeLong(0);
        msgBuilder.writeByte(ServerCommand.stufftext);
        msgBuilder.writeString("precache\n");

        const onMessage = (mockDriver.onMessage as Mock).mock.calls[0][0];
        onMessage(msgBuilder.getData());

        expect((connection as any).state).toBe(ConnectionState.Active);
        expect(connection.isConnected()).toBe(true);

        // Should send "begin"
        const lastCall = mockDriver.send.mock.lastCall[0];
        const stream = new BinaryStream(lastCall.buffer);
        expect(stream.readByte()).toBe(ClientCommand.stringcmd);
        expect(stream.readString()).toBe('begin');
    });

    it('should send clc_move when sending command', async () => {
        // Verify current behavior (Phase 1)
        await connection.connect('ws://localhost:27910');
        (connection as any).state = ConnectionState.Active;

        const cmd = {
            msec: 100,
            buttons: PlayerButton.Attack,
            angles: { x:0, y:0, z:0 },
            forwardmove: 100,
            sidemove: 0,
            upmove: 0
        } as UserCommand;

        connection.sendCommand(cmd);

        const lastCall = mockDriver.send.mock.lastCall[0];
        const stream = new BinaryStream(lastCall.buffer);

        // Skip header (Seq + Ack)
        stream.readLong();
        stream.readLong();

        expect(stream.readByte()).toBe(ClientCommand.move);
        expect(stream.readByte()).toBe(0); // checksum
        expect(stream.readLong()).toBe(0); // lastframe

        expect(stream.readByte()).toBe(100); // msec
        expect(stream.readByte()).toBe(PlayerButton.Attack);
        // ... verify other fields if needed
    });
});
