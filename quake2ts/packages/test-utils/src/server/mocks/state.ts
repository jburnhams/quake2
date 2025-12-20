import { Server, ServerState, ServerStatic, Client, ClientState } from '@quake2ts/server';
import { NetDriver, MAX_CONFIGSTRINGS, MAX_EDICTS, EntityState } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';
import { vi } from 'vitest';

/**
 * Creates a mock server state object.
 * @param overrides Optional overrides for the server state.
 */
export function createMockServerState(overrides?: Partial<Server>): Server {
    return {
        state: ServerState.Game,
        attractLoop: false,
        loadGame: false,
        startTime: Date.now(),
        time: 0,
        frame: 0,
        name: 'test_map',
        collisionModel: null,
        configStrings: new Array(MAX_CONFIGSTRINGS).fill(''),
        baselines: new Array(MAX_EDICTS).fill(null),
        multicastBuf: new Uint8Array(0),
        ...overrides
    };
}

/**
 * Creates a mock server static object.
 * @param maxClients Maximum number of clients.
 * @param overrides Optional overrides for the server static state.
 */
export function createMockServerStatic(maxClients: number = 16, overrides?: Partial<ServerStatic>): ServerStatic {
    return {
        initialized: true,
        realTime: Date.now(),
        mapCmd: '',
        spawnCount: 1,
        clients: new Array(maxClients).fill(null),
        lastHeartbeat: 0,
        challenges: [],
        ...overrides
    };
}

/**
 * Creates a mock server client.
 * @param clientNum The client index.
 * @param overrides Optional overrides for the client.
 */
export function createMockServerClient(clientNum: number, overrides?: Partial<Client>): Client {
    // Create a minimal mock net driver
    const mockNet: NetDriver = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        send: vi.fn(),
        onMessage: vi.fn(),
        onClose: vi.fn(),
        onError: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true)
    };

    return {
        index: clientNum,
        state: ClientState.Connected,
        edict: { index: clientNum + 1 } as Entity,
        net: mockNet,
        netchan: {
            qport: 0,
            remoteAddress: '127.0.0.1',
            incomingSequence: 0,
            outgoingSequence: 0,
            lastReceived: 0,
            process: vi.fn(),
            transmit: vi.fn(),
            writeReliableByte: vi.fn(),
            writeReliableShort: vi.fn(),
            writeReliableLong: vi.fn(),
            writeReliableString: vi.fn(),
            writeReliableData: vi.fn(),
        } as any, // Cast as any because NetChan might be complex to fully mock here
        userInfo: '',
        lastMessage: 0,
        lastCommandTime: 0,
        commandCount: 0,
        messageQueue: [],
        frames: [],
        lastFrame: 0,
        lastPacketEntities: [],
        challenge: 0,
        lastConnect: 0,
        ping: 0,
        rate: 0,
        name: `Client${clientNum}`,
        messageLevel: 0,
        datagram: new Uint8Array(0),
        downloadSize: 0,
        downloadCount: 0,
        commandMsec: 0,
        frameLatency: [],
        messageSize: [],
        suppressCount: 0,
        commandQueue: [],
        lastCmd: {
            msec: 0,
            buttons: 0,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 0,
            sidemove: 0,
            upmove: 0,
            sequence: 0,
            lightlevel: 0,
            impulse: 0,
            serverFrame: 0
        },
        ...overrides
    };
}

/**
 * Mock interface for the Server class (DedicatedServer).
 * This allows mocking the server instance itself.
 */
export interface MockServer {
    start(mapName: string): Promise<void>;
    stop(): void;
    // tick(): void; // runFrame is private in DedicatedServer, usually we simulate via game.frame
    multicast(origin: any, type: any, event: any, ...args: any[]): void;
    unicast(ent: Entity, reliable: boolean, event: any, ...args: any[]): void;
    configstring(index: number, value: string): void;
    kickPlayer(clientId: number): void;
    changeMap(mapName: string): Promise<void>;
}

/**
 * Creates a mock server instance.
 * @param overrides Optional overrides for server methods.
 */
export function createMockServer(overrides?: Partial<MockServer>): MockServer {
    return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn(),
        multicast: vi.fn(),
        unicast: vi.fn(),
        configstring: vi.fn(),
        kickPlayer: vi.fn(),
        changeMap: vi.fn().mockResolvedValue(undefined),
        ...overrides
    };
}
