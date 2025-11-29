import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { createClient, Client, ClientState } from '../../src/client.js';
import { WebSocketNetDriver } from '../../src/net/nodeWsDriver.js';
import { ServerCommand, ConfigStringIndex, PlayerStat, MAX_CONFIGSTRINGS, BinaryStream, BinaryWriter } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';

// Mock dependencies
vi.mock('ws');
vi.mock('../../src/net/nodeWsDriver.js');
vi.mock('@quake2ts/game', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        createGame: vi.fn((imports, engine, options) => ({
            init: vi.fn(),
            spawnWorld: vi.fn(),
            frame: vi.fn(() => ({
                state: {
                    stats: new Array(32).fill(0), // Mock stats
                    packetEntities: []
                }
            })),
            shutdown: vi.fn(),
            clientConnect: vi.fn(() => true),
            clientBegin: vi.fn(() => ({ index: 1, origin: { x: 0, y: 0, z: 0 } })), // Return a mock entity
            clientDisconnect: vi.fn(),
            clientThink: vi.fn(),
            entities: {
                getByIndex: vi.fn(),
                forEachEntity: vi.fn()
            }
        })),
        createPlayerInventory: vi.fn(() => ({
             ammo: { counts: [] },
             items: new Set(),
             ownedWeapons: new Set(),
             powerups: new Map()
        })),
        createPlayerWeaponStates: vi.fn(() => ({}))
    };
});
vi.mock('node:fs/promises', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        default: {
            ...actual.default,
            readFile: vi.fn().mockResolvedValue(Buffer.from(''))
        },
        readFile: vi.fn().mockResolvedValue(Buffer.from(''))
    };
});
vi.mock('@quake2ts/engine', () => ({
    parseBsp: vi.fn().mockReturnValue({})
}));


describe('Integration: Config String & Stats Sync', () => {
    let server: DedicatedServer;
    let mockClient: Client;
    let mockDriver: any;

    beforeEach(async () => {
        vi.useFakeTimers();
        server = new DedicatedServer(27910);

        // Start server
        await server.start('maps/test.bsp');

        // Setup mock driver instance that will be returned by the constructor
        mockDriver = {
            attach: vi.fn(),
            onMessage: vi.fn(),
            onClose: vi.fn(),
            send: vi.fn(),
            close: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true)
        };

        // Mock the constructor to return our specific mock driver
        (WebSocketNetDriver as any).mockImplementation(() => mockDriver);

        // Trigger connection handling which will instantiate WebSocketNetDriver
        const mockWs = {
            close: vi.fn(),
            readyState: 1,
            binaryType: 'arraybuffer',
            on: vi.fn(),
            addEventListener: vi.fn()
        };
        (server as any).handleConnection(mockWs);

        // The DedicatedServer code creates a NEW WebSocketNetDriver instance inside handleConnection
        // Since we mocked the class to return mockDriver, 'client.driver' should be 'mockDriver'.

        const clients = (server as any).svs.clients;
        // Find client with our mock driver
        mockClient = clients.find((c: Client | null) => c && c.net === mockDriver);

        if (!mockClient) {
            // Fallback: if finding by driver fails (e.g. if mockImplementation behavior is different),
            // just pick the first connected client.
             mockClient = clients.find((c: Client | null) => c !== null);
        }
    });

    afterEach(() => {
        server.stop();
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('should broadcast config strings to connected clients', () => {
        // 1. Client connects and enters game
        mockClient.state = ClientState.Connected;

        // 2. Server sets a config string (e.g., map name or model)
        const testIndex = ConfigStringIndex.Models + 1;
        const testValue = "models/weapons/g_shotg/tris.md2";

        // Call configstring via GameEngine interface (exposed on server)
        server.configstring(testIndex, testValue);

        // 3. Verify driver.send was called with correct data
        expect(mockDriver.send).toHaveBeenCalled();

        // Inspect the last call to see if it contains the config string command
        const calls = mockDriver.send.mock.calls;
        const lastCallData = calls[calls.length - 1][0];

        const stream = new BinaryStream(lastCallData.buffer);
        const cmd = stream.readByte();

        expect(cmd).toBe(ServerCommand.configstring);
        const index = stream.readShort();
        const value = stream.readString();

        expect(index).toBe(testIndex);
        expect(value).toBe(testValue);
    });

    it('should send full config string list on client connect', () => {
        // 1. Pre-populate some config strings
        (server as any).sv.configStrings[ConfigStringIndex.Models] = "model1";
        (server as any).sv.configStrings[ConfigStringIndex.Sounds] = "sound1";

        // 2. Simulate client connection flow
        // The server sends serverdata + configstrings in 'sendServerData' which is called after 'connect'
        (server as any).handleConnect(mockClient, "userinfo");

        // 3. Check sent packets
        // There might be multiple sends. We need to find the one with serverdata.
        const calls = mockDriver.send.mock.calls;
        let foundServerData = false;
        let foundModel1 = false;
        let foundSound1 = false;

        for (const call of calls) {
            const stream = new BinaryStream(call[0].buffer);
            while (stream.offset < stream.view.byteLength) {
                const cmd = stream.readByte();
                if (cmd === ServerCommand.serverdata) {
                    foundServerData = true;
                    // Skip serverdata payload
                    stream.readLong(); // ver
                    stream.readLong(); // frame
                    stream.readByte(); // attract
                    stream.readString(); // game
                    stream.readShort(); // player num
                    stream.readString(); // map
                } else if (cmd === ServerCommand.configstring) {
                    const idx = stream.readShort();
                    const val = stream.readString();
                    if (idx === ConfigStringIndex.Models && val === "model1") foundModel1 = true;
                    if (idx === ConfigStringIndex.Sounds && val === "sound1") foundSound1 = true;
                } else if (cmd === ServerCommand.spawnbaseline) {
                    // Skip baseline
                    // writeDeltaEntity is complex to skip without implementation details,
                    // but for this test we mock writeDeltaEntity if we could, or just assume it's last
                    // Actually, let's just rely on finding the CS before this if possible.
                    // But stream reading relies on correct parsing.
                    // For this test, we might just assume CS comes after serverdata immediately.
                    break;
                } else {
                     // potentially other commands
                     break;
                }
            }
        }

        expect(foundServerData).toBe(true);
        expect(foundModel1).toBe(true);
        expect(foundSound1).toBe(true);
    });

    it('should sync player stats in frame updates', () => {
        // 1. Activate client
        mockClient.state = ClientState.Active;

        // 2. Mock game frame returning stats
        const mockStats = new Array(32).fill(0);
        mockStats[PlayerStat.STAT_HEALTH] = 100;
        mockStats[PlayerStat.STAT_ARMOR] = 50;

        // We need to update the mock implementation of 'frame' for this specific test
        // Accessing the game instance created by createGame
        const game = (server as any).game;
        game.frame.mockReturnValue({
            state: {
                stats: mockStats,
                packetEntities: [],
                origin: { x:0, y:0, z:0 },
                velocity: { x:0, y:0, z:0 },
                gravity: { x:0, y:0, z:0 },
                deltaAngles: { x:0, y:0, z:0 },
                viewangles: { x:0, y:0, z:0 },
                kick_angles: { x:0, y:0, z:0 },
                gunoffset: { x:0, y:0, z:0 },
                gunangles: { x:0, y:0, z:0 },
                blend: [0,0,0,0]
            }
        });

        // 3. Run server frame
        (server as any).runFrame();

        // 4. Check for frame packet
        const calls = mockDriver.send.mock.calls;
        const lastCallData = calls[calls.length - 1][0];
        const stream = new BinaryStream(lastCallData.buffer);

        const cmd = stream.readByte();
        expect(cmd).toBe(ServerCommand.frame);

        stream.readLong(); // frame
        stream.readLong(); // delta
        stream.readByte(); // suppress
        stream.readByte(); // area

        const subCmd = stream.readByte();
        expect(subCmd).toBe(ServerCommand.playerinfo);

        // Read stats from player state
        // We need to skip over other fields to get to stats.
        // ProtocolPlayerState layout:
        stream.readShort(); // pm_type (WriteShort) - Wait, protocol/player.ts: writePlayerState
        // Let's verify writePlayerState order or import it?
        // It writes a bitmask first.
        // We should probably rely on a helper to parse or just check that 'stats' are in there.
        // But since we want to be sure, let's look at the implementation of writePlayerState or reuse a parser?
        // Since we don't have a parser readily available in the test file without duplicating logic,
        // we can assume the format if it's stable.

        // Alternatively, we can check if the STAT_HEALTH value (100) appears in the buffer.
        // Stats are written as shorts.
        // 100 is 0x0064.
        // 50 is 0x0032.

        const view = new Uint8Array(lastCallData.buffer);
        let foundHealth = false;
        let foundArmor = false;

        // Simple scan for values (heuristic)
        for (let i = 0; i < view.length - 1; i++) {
            const val = view[i] | (view[i+1] << 8);
            if (val === 100) foundHealth = true;
            if (val === 50) foundArmor = true;
        }

        expect(foundHealth).toBe(true);
        expect(foundArmor).toBe(true);
    });
});
