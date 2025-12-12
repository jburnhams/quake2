import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiplayerConnection, ConnectionState } from '../../src/net/connection';
import { NetDriver, UserCommand, ClientCommand, ServerCommand, BinaryWriter, NetChan } from '@quake2ts/shared';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver';

// Mock dependencies
vi.mock('../../src/net/browserWsDriver', () => {
    return {
        BrowserWebSocketNetDriver: vi.fn(function() {
            return {
                connect: vi.fn().mockResolvedValue(undefined),
                disconnect: vi.fn(),
                send: vi.fn(),
                onMessage: vi.fn(),
                onClose: vi.fn(),
                onError: vi.fn()
            };
        })
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
        expect(connection.getPing()).toBe(0);
    });

    it('should transition to Connecting and then Challenge state on connect', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        expect(mockDriver.connect).toHaveBeenCalledWith('ws://localhost:27910');
        expect((connection as any).state).toBe(ConnectionState.Challenge);
        // Verify it sends getchallenge
        expect(mockDriver.send).toHaveBeenCalled();

        // Check state change events
        // 1. Connecting
        // 2. Challenge
        expect(stateChangeSpy).toHaveBeenCalledTimes(2);
        expect(stateChangeSpy).toHaveBeenNthCalledWith(1, ConnectionState.Connecting);
        expect(stateChangeSpy).toHaveBeenNthCalledWith(2, ConnectionState.Challenge);
    });

    it('should support connectToServer with address and port', async () => {
        await connection.connectToServer('localhost', 27910);
        expect(mockDriver.connect).toHaveBeenCalledWith('ws://localhost:27910');
    });

    it('should complete handshake sequence and emit events', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        stateChangeSpy.mockClear();

        // Wait for next tick to ensure async operations complete if any
        await new Promise(resolve => setTimeout(resolve, 0));

        // Create a server-side NetChan to format packets correctly
        const serverNetChan = new NetChan();
        const sentPacket = mockDriver.send.mock.calls[0][0] as Uint8Array;
        const view = new DataView(sentPacket.buffer, sentPacket.byteOffset, sentPacket.byteLength);
        const qport = view.getUint16(8, true);
        serverNetChan.setup(qport);

        // --- 1. Server sends challenge ---
        // Simulate "challenge 12345" response
        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.stufftext);
        writer.writeString('challenge 12345\n');

        const challengePacket = serverNetChan.transmit(writer.getData());
        const onMessage = mockDriver.onMessage.mock.calls[0][0];
        onMessage(challengePacket);

        // Should have sent connect command
        expect(mockDriver.send).toHaveBeenCalledTimes(2); // getchallenge + connect

        // --- 2. Server sends serverdata ---
        // Simulate svc_serverdata
        const writer2 = new BinaryWriter();
        writer2.writeByte(ServerCommand.serverdata);
        writer2.writeLong(34); // Protocol
        writer2.writeLong(1); // Server count
        writer2.writeByte(0); // Attract
        writer2.writeString("baseq2");
        writer2.writeShort(0); // Player num
        writer2.writeString("maps/test.bsp");

        const serverDataPacket = serverNetChan.transmit(writer2.getData());
        onMessage(serverDataPacket);

        expect((connection as any).state).toBe(ConnectionState.Loading);
        expect(stateChangeSpy).toHaveBeenCalledWith(ConnectionState.Loading);

        // --- 3. Server sends precache (end of loading) ---
        // Simulate "precache" which finishes loading
        const writer3 = new BinaryWriter();
        writer3.writeByte(ServerCommand.stufftext);
        writer3.writeString('precache\n');

        const precachePacket = serverNetChan.transmit(writer3.getData());
        onMessage(precachePacket);

        expect(connection.isConnected()).toBe(true);
        expect((connection as any).state).toBe(ConnectionState.Active);
        expect(stateChangeSpy).toHaveBeenCalledWith(ConnectionState.Active);
    });

    it('should handle disconnection and cleanup', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        connection.disconnect();

        expect(mockDriver.disconnect).toHaveBeenCalled();
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
        expect(stateChangeSpy).toHaveBeenLastCalledWith(ConnectionState.Disconnected);
        expect((connection as any).configStrings.size).toBe(0);
        expect((connection as any).baselines.size).toBe(0);
    });

    it('should handle connection errors', async () => {
        const errorSpy = vi.fn();
        connection.onConnectionError = errorSpy;

        const error = new Error('Connection failed');
        mockDriver.connect.mockRejectedValueOnce(error);

        await expect(connection.connect('ws://bad-url')).rejects.toThrow('Connection failed');
        expect(errorSpy).toHaveBeenCalledWith(error);
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
    });

    it('should update ping on message receipt', async () => {
        await connection.connect('ws://localhost:27910');

        // Setup initial ping time
        const now = Date.now();
        (connection as any).lastPingTime = now - 50; // Simulate 50ms ago

        // Receive a packet
        const serverNetChan = new NetChan();
        const sentPacket = mockDriver.send.mock.calls[0][0] as Uint8Array;
        const view = new DataView(sentPacket.buffer, sentPacket.byteOffset, sentPacket.byteLength);
        const qport = view.getUint16(8, true);
        serverNetChan.setup(qport);

        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.nop);
        const packet = serverNetChan.transmit(writer.getData());

        const onMessage = mockDriver.onMessage.mock.calls[0][0];
        onMessage(packet);

        expect(connection.getPing()).toBeGreaterThanOrEqual(50);
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
