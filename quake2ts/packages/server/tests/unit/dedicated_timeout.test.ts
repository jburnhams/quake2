
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { ClientState } from '../../src/client.js';
import { WebSocketNetDriver } from '../../src/net/nodeWsDriver.js';
import { WebSocketServer } from 'ws';

// Mock ws
vi.mock('ws', () => {
    return {
        WebSocketServer: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn()
        })),
        WebSocket: vi.fn().mockImplementation(() => ({
            on: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
            readyState: 1
        }))
    };
});

// Mock fs
vi.mock('node:fs/promises', async () => {
    return {
        default: {
            readFile: vi.fn().mockResolvedValue(Buffer.from(''))
        },
        readFile: vi.fn().mockResolvedValue(Buffer.from(''))
    };
});

// Mock game creation
vi.mock('@quake2ts/game', async () => {
    const actual = await vi.importActual('@quake2ts/game');
    return {
        ...actual,
        createGame: vi.fn().mockReturnValue({
            init: vi.fn(),
            spawnWorld: vi.fn(),
            shutdown: vi.fn(),
            frame: vi.fn().mockReturnValue({ state: {} }),
            entities: {
                getByIndex: vi.fn(),
                forEachEntity: vi.fn()
            },
            clientConnect: vi.fn().mockReturnValue(true),
            clientBegin: vi.fn().mockReturnValue({ index: 1, origin: {x:0,y:0,z:0} }),
            clientDisconnect: vi.fn(),
            clientThink: vi.fn()
        }),
        createPlayerInventory: vi.fn(),
        createPlayerWeaponStates: vi.fn()
    };
});

// Access private properties for testing
function getPrivate(obj: any, key: string) {
    return obj[key];
}

describe('DedicatedServer Timeout', () => {
    let server: DedicatedServer;
    let consoleLogSpy: any;
    let consoleWarnSpy: any;

    beforeEach(async () => {
        vi.useFakeTimers();
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        server = new DedicatedServer(27910);
        await server.start('maps/test.bsp');
    });

    afterEach(() => {
        server.stop();
        vi.clearAllMocks();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        vi.useRealTimers();
    });

    it('should disconnect a client after timeout', () => {
        // Access svs.clients to manually inject a client
        const svs = getPrivate(server, 'svs');
        const sv = getPrivate(server, 'sv');

        // Mock a connected client
        const mockDriver = new WebSocketNetDriver();
        const mockSocket = {
            close: vi.fn(),
            readyState: 1,
            onclose: null as any
        };
        mockDriver.attach(mockSocket as any);

        // Manually trigger handleConnection-like logic or just inject
        // We'll inject directly into svs.clients for precise control
        const clientIndex = 0;
        const client = {
            index: clientIndex,
            state: ClientState.Connected,
            net: mockDriver,
            lastMessage: sv.frame, // Last message was NOW
            messageQueue: [],
            frames: [],
            edict: null,
            userInfo: '',
            lastCmd: {},
            lastConnect: Date.now(),
            name: 'TestClient',
            frameLatency: [],
            messageSize: [],
            lastPacketEntities: []
        };

        svs.clients[clientIndex] = client;

        // Set up cleanup spy
        // We expect dropClient to be implemented and called
        const dropClientSpy = vi.spyOn(server as any, 'dropClient');

        // Advance 29 seconds (290 frames)
        for(let i=0; i<290; i++) {
            vi.runOnlyPendingTimers();
        }

        // Verify still connected
        expect(svs.clients[clientIndex]).not.toBeNull();
        expect(dropClientSpy).not.toHaveBeenCalled();
        expect(mockSocket.close).not.toHaveBeenCalled();

        // Advance another 20 frames (2 seconds) -> Total 31 seconds
        for(let i=0; i<20; i++) {
             vi.runOnlyPendingTimers();
        }

        // Now diff is 310 > 300. Should disconnect.
        expect(dropClientSpy).toHaveBeenCalledWith(client);
        expect(mockSocket.close).toHaveBeenCalled();
    });

    it('should NOT disconnect a client if they send messages', () => {
        const svs = getPrivate(server, 'svs');
        const sv = getPrivate(server, 'sv');

        const mockDriver = new WebSocketNetDriver();
        const mockSocket = {
            close: vi.fn(),
            readyState: 1,
            onclose: null as any
        };
        mockDriver.attach(mockSocket as any);

        const clientIndex = 0;
        const client = {
            index: clientIndex,
            state: ClientState.Connected,
            net: mockDriver,
            lastMessage: sv.frame,
            messageQueue: [],
            frames: [],
            edict: null,
            userInfo: '',
            lastCmd: {},
            lastConnect: Date.now(),
            name: 'TestClient',
            frameLatency: [],
            messageSize: [],
            lastPacketEntities: []
        };

        svs.clients[clientIndex] = client;
        const dropClientSpy = vi.spyOn(server as any, 'dropClient');

        // Advance 15 seconds
        for(let i=0; i<150; i++) {
            vi.runOnlyPendingTimers();
        }

        // Simulate packet received -> updates lastMessage
        client.lastMessage = sv.frame;

        // Advance another 16 seconds
        for(let i=0; i<160; i++) {
            vi.runOnlyPendingTimers();
        }

        // Total time 31 seconds, but lastMessage was 16 seconds ago.
        expect(dropClientSpy).not.toHaveBeenCalled();
    });
});
