import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import { WebSocketNetDriver } from '../src/net/nodeWsDriver.js';
import { WebSocketServer, WebSocket } from 'ws';
import { ClientMessageParser } from '../src/protocol.js';
import { BinaryWriter, ClientCommand, ServerCommand } from '@quake2ts/shared';

// Mock dependencies
vi.mock('@quake2ts/game', () => ({
    createGame: vi.fn().mockReturnValue({
        init: vi.fn(),
        spawnWorld: vi.fn(),
        clientConnect: vi.fn(),
        clientBegin: vi.fn(),
        clientDisconnect: vi.fn(),
        clientThink: vi.fn(),
        frame: vi.fn(),
        shutdown: vi.fn(),
        spawn: vi.fn().mockReturnValue({ id: 1 }), // Mock spawn to return a dummy entity
        entities: new Map(),
    }),
}));

vi.mock('ws', () => {
    return {
        WebSocketServer: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn(),
        })),
        WebSocket: vi.fn(),
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

describe('Server Handshake', () => {
    let server: DedicatedServer;
    let wssMock: any;
    let connectionCallback: (ws: WebSocket) => void;

    beforeEach(async () => {
        server = new DedicatedServer(27910);
        await server.start('test_map');
        wssMock = (WebSocketServer as unknown as any).mock.results[0].value;
        connectionCallback = wssMock.on.mock.calls.find((call: any) => call[0] === 'connection')[1];
    });

    it('should send serverdata on connect command', () => {
        const ws = new WebSocket('');
        const driver = new WebSocketNetDriver();
        (WebSocketNetDriver as any).mock.results[0].value = driver;

        connectionCallback(ws);

        const onMessageCallback = (driver.onMessage as any).mock.calls[0][0];

        const writer = new BinaryWriter();
        writer.writeByte(ClientCommand.stringcmd);
        writer.writeString('connect');
        onMessageCallback(writer.getData());

        expect(driver.send).toHaveBeenCalled();
        const sentData = (driver.send as any).mock.calls[0][0];
        const sentView = new DataView(sentData.buffer);
        expect(sentView.getUint8(0)).toBe(ServerCommand.serverdata);
    });

    it('should spawn client on begin command', async () => {
        const ws = new WebSocket('');
        const driver = new WebSocketNetDriver();
        (WebSocketNetDriver as any).mock.results[0].value = driver;

        connectionCallback(ws);

        const onMessageCallback = (driver.onMessage as any).mock.calls[0][0];

        // First, send connect
        const writerConnect = new BinaryWriter();
        writerConnect.writeByte(ClientCommand.stringcmd);
        writerConnect.writeString('connect');
        onMessageCallback(writerConnect.getData());

        // Then, send begin
        const writerBegin = new BinaryWriter();
        writerBegin.writeByte(ClientCommand.stringcmd);
        writerBegin.writeString('begin');
        onMessageCallback(writerBegin.getData());

        const gameMock = (await import('@quake2ts/game')).createGame();
        expect(gameMock.clientBegin).toHaveBeenCalled();
    });
});
