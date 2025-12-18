import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { createClient, Client, ClientState } from '../../src/client.js';
import { ServerCommand, ConfigStringIndex, PlayerStat, MAX_CONFIGSTRINGS, BinaryStream, BinaryWriter, NetDriver } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';
import { createMockTransport, MockTransport } from '@quake2ts/test-utils';

// Mock dependencies
// ws mock removed
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
    parseBsp: vi.fn().mockReturnValue({
        planes: [],
        nodes: [],
        leafs: [],
        brushes: [],
        models: [],
        leafLists: { leafBrushes: [] },
        texInfo: [],
        brushSides: [],
        visibility: { numClusters: 0, clusters: [] }
    })
}));


describe('Integration: Config String & Stats Sync', () => {
    let server: DedicatedServer;
    let mockClient: Client;
    let mockDriver: any;
    let consoleLogSpy: any;
    let consoleWarnSpy: any;
    let transport: MockTransport;

    beforeEach(async () => {
        vi.useFakeTimers({
            toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
        });
        // Suppress logs for cleaner output
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        transport = createMockTransport();
        server = new DedicatedServer({ port: 27910, transport });

        // Start server
        await server.startServer('maps/test.bsp');

        // Setup mock driver instance
        mockDriver = {
            attach: vi.fn(),
            onMessage: vi.fn(),
            onClose: vi.fn(),
            send: vi.fn(),
            close: vi.fn(),
            isConnected: vi.fn().mockReturnValue(true),
            disconnect: vi.fn()
        };

        // Simulate connection via Transport
        transport.simulateConnection(mockDriver, {});

        const clients = (server as any).svs.clients;
        // Find client with our mock driver
        mockClient = clients.find((c: Client | null) => c && c.net === mockDriver);

        if (!mockClient) {
             mockClient = clients.find((c: Client | null) => c !== null);
        }
    });

    afterEach(() => {
        server.stopServer();
        vi.useRealTimers();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
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

        // Scan for the command byte (ServerCommand.configstring)
        // With NetChan, it's wrapped.
        const view = new Uint8Array(lastCallData.buffer);
        let found = false;

        // Command byte (13) + index (2 bytes) + value
        // We look for [13, index_low, index_high]
        // testIndex is ConfigStringIndex.Models + 1 (probably small number)
        const idxLow = testIndex & 0xff;
        const idxHigh = (testIndex >> 8) & 0xff;

        for(let i=0; i<view.length-3; i++) {
            if (view[i] === ServerCommand.configstring && view[i+1] === idxLow && view[i+2] === idxHigh) {
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
    });

    it('should send full config string list on client connect', () => {
        // 1. Pre-populate some config strings
        (server as any).sv.configStrings[ConfigStringIndex.Models] = "model1";
        (server as any).sv.configStrings[ConfigStringIndex.Sounds] = "sound1";

        // 2. Simulate client connection flow
        (server as any).handleConnect(mockClient, "userinfo");

        // 3. Check sent packets
        const calls = mockDriver.send.mock.calls;
        let foundServerData = false;
        let foundModel1 = false;
        let foundSound1 = false;

        for (const call of calls) {
            const data = call[0] instanceof Uint8Array ? call[0] : new Uint8Array(call[0].buffer);

            // Search for strings in the packet data
            const textDecoder = new TextDecoder();
            // We can't decode the whole binary as text easily, but we can search for substring bytes
            // Or just decode and search (binary garbage might be invalid utf8 but strings usually survive)
            const text = textDecoder.decode(data);

            if (text.includes("baseq2") && text.includes("maps/test.bsp")) {
                foundServerData = true;
            }
            if (text.includes("model1")) foundModel1 = true;
            if (text.includes("sound1")) foundSound1 = true;
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

        // Scan buffer for stats values (100 and 50)
        // Since NetChan header is 10 bytes, start from there.

        const view = new Uint8Array(lastCallData.buffer);
        let foundHealth = false;
        let foundArmor = false;

        // Simple scan for values (heuristic)
        // Note: Stats are shorts (2 bytes)
        for (let i = 10; i < view.length - 1; i++) {
            const val = view[i] | (view[i+1] << 8);
            if (val === 100) foundHealth = true;
            if (val === 50) foundArmor = true;
        }

        expect(foundHealth).toBe(true);
        expect(foundArmor).toBe(true);
    });
});
