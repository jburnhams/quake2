import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MultiplayerConnection, ConnectionState } from '../../src/net/connection.js';
import { NetDriver, UserCommand, ClientCommand, ServerCommand, BinaryWriter, NetChan } from '@quake2ts/shared';
import { MockNetDriver } from '@quake2ts/test-utils';
import { BrowserWebSocketNetDriver } from '../../src/net/browserWsDriver.js';

// Mock dependencies
vi.mock('../../src/net/browserWsDriver.js', () => {
    return {
        BrowserWebSocketNetDriver: class {
            constructor() {
                return new MockNetDriver();
            }
        }
    };
});

describe('MultiplayerConnection', () => {
    let connection: MultiplayerConnection;
    let mockDriver: MockNetDriver;

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
        vi.clearAllMocks();
        connection = new MultiplayerConnection({
            username: 'Player',
            model: 'male',
            skin: 'grunt'
        });
        mockDriver = (connection as any).driver;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize in disconnected state', () => {
        expect(connection.isConnected()).toBe(false);
        expect(connection.getPing()).toBe(0);
    });

    it('should transition to Connecting and then Challenge state on connect', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        expect(mockDriver.connectSpy).toHaveBeenCalledWith('ws://localhost:27910');
        expect((connection as any).state).toBe(ConnectionState.Challenge);
        // Verify it sends getchallenge
        expect(mockDriver.sendSpy).toHaveBeenCalled();

        // Check state change events
        expect(stateChangeSpy).toHaveBeenCalledTimes(2);
        expect(stateChangeSpy).toHaveBeenNthCalledWith(1, ConnectionState.Connecting);
        expect(stateChangeSpy).toHaveBeenNthCalledWith(2, ConnectionState.Challenge);
    });

    it('should support connectToServer with address and port', async () => {
        await connection.connectToServer('localhost', 27910);
        expect(mockDriver.connectSpy).toHaveBeenCalledWith('ws://localhost:27910');
    });

    it('should complete handshake sequence and emit events', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        stateChangeSpy.mockClear();

        // Wait for next tick
        await new Promise(resolve => setTimeout(resolve, 0));

        // Create a server-side NetChan
        const serverNetChan = new NetChan();
        const sentPacket = mockDriver.getLastSentMessage()!;
        const view = new DataView(sentPacket.buffer, sentPacket.byteOffset, sentPacket.byteLength);
        const qport = view.getUint16(8, true);
        serverNetChan.setup(qport);
        mockDriver.clearSentMessages();

        // --- 1. Server sends challenge ---
        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.stufftext);
        writer.writeString('challenge 12345\n');
        const challengePacket = serverNetChan.transmit(writer.getData());

        mockDriver.receiveMessage(challengePacket);

        // Should have sent connect command
        expect(mockDriver.sendSpy).toHaveBeenCalled();

        // --- 2. Server sends serverdata ---
        const writer2 = new BinaryWriter();
        writer2.writeByte(ServerCommand.serverdata);
        // Protocol 34 (Standard Q2)
        writer2.writeLong(34); // Protocol
        writer2.writeLong(1);  // Server count
        writer2.writeByte(0);  // Attract loop
        writer2.writeString("baseq2"); // Game dir
        writer2.writeShort(0); // Player num
        writer2.writeString("maps/test.bsp"); // Level name

        const serverDataPacket = serverNetChan.transmit(writer2.getData());

        mockDriver.receiveMessage(serverDataPacket);

        expect((connection as any).state).toBe(ConnectionState.Loading);
        expect(stateChangeSpy).toHaveBeenCalledWith(ConnectionState.Loading);

        // --- 3. Server sends precache ---
        const writer3 = new BinaryWriter();
        writer3.writeByte(ServerCommand.stufftext);
        writer3.writeString('precache\n');
        const precachePacket = serverNetChan.transmit(writer3.getData());

        mockDriver.receiveMessage(precachePacket);

        expect(connection.isConnected()).toBe(true);
        expect((connection as any).state).toBe(ConnectionState.Active);
        expect(stateChangeSpy).toHaveBeenCalledWith(ConnectionState.Active);
    });

    it('should handle disconnection and cleanup', async () => {
        const stateChangeSpy = vi.fn();
        connection.onConnectionStateChange = stateChangeSpy;

        await connection.connect('ws://localhost:27910');
        connection.disconnect();

        expect(mockDriver.disconnectSpy).toHaveBeenCalled();
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
        expect(stateChangeSpy).toHaveBeenLastCalledWith(ConnectionState.Disconnected);
    });

    it('should handle connection errors', async () => {
        const errorSpy = vi.fn();
        connection.onConnectionError = errorSpy;

        const error = new Error('Connection failed');
        mockDriver.connectSpy.mockRejectedValueOnce(error);

        await expect(connection.connect('ws://bad-url')).rejects.toThrow('Connection failed');
        expect(errorSpy).toHaveBeenCalledWith(error);
        expect((connection as any).state).toBe(ConnectionState.Disconnected);
    });

    it('should update ping on message receipt', async () => {
        await connection.connect('ws://localhost:27910');

        const now = Date.now();
        (connection as any).lastPingTime = now - 50;

        const serverNetChan = new NetChan();
        const sentPacket = mockDriver.getLastSentMessage()!;
        const view = new DataView(sentPacket.buffer, sentPacket.byteOffset, sentPacket.byteLength);
        const qport = view.getUint16(8, true);
        serverNetChan.setup(qport);

        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.nop);
        const packet = serverNetChan.transmit(writer.getData());

        mockDriver.receiveMessage(packet);

        expect(connection.getPing()).toBeGreaterThanOrEqual(50);
    });

    it('should buffer last 64 commands', async () => {
        (connection as any).state = ConnectionState.Active;

        for (let i = 0; i < 70; i++) {
            connection.sendCommand({ ...mockCmd, serverFrame: i });
        }

        const cmdBuffer = (connection as any).commandHistory as UserCommand[];
        expect(cmdBuffer).toBeDefined();
        expect(cmdBuffer.length).toBe(64);
        expect(cmdBuffer[0].serverFrame).toBe(6);
        expect(cmdBuffer[63].serverFrame).toBe(69);
    });

    it('should attach serverFrame to sent commands if available', async () => {
        (connection as any).latestServerFrame = 123;
        (connection as any).state = ConnectionState.Active;

        connection.sendCommand({ ...mockCmd, serverFrame: undefined });

        const cmdBuffer = (connection as any).commandHistory as UserCommand[];
        expect(cmdBuffer[0].serverFrame).toBe(123);
    });
});
