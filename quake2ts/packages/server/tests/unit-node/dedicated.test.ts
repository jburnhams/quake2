import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../../src/dedicated.js';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState } from '../../src/client.js';
import { UPDATE_BACKUP } from '@quake2ts/shared';
import {
    createMockTransport,
    MockTransport,
    createMockServerClient,
    createMockGameExports,
    createGameStateSnapshotFactory,
    createServerSnapshot
} from '@quake2ts/test-utils';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from([0])),
  },
}));
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
  }),
}));
vi.mock('@quake2ts/game', () => ({
  createGame: vi.fn(),
  createPlayerInventory: vi.fn(),
  createPlayerWeaponStates: vi.fn(),
}));

const FRAME_TIME_MS = 100; // 10Hz

describe('DedicatedServer', () => {
  let server: DedicatedServer;
  let mockGame: GameExports;
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let transport: MockTransport;

  beforeEach(async () => {
    // Only fake specific timers to avoid blocking internal promises/fs mocks
    vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date']
    });
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockGame = createMockGameExports({
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' } as any)),
      frame: vi.fn().mockReturnValue({
        state: createGameStateSnapshotFactory({
           gravity: { x: 0, y: 0, z: -800 },
           stats: new Array(32).fill(0),
        })
      }),
      clientConnect: vi.fn().mockReturnValue(true),
    });

    (createGame as vi.Mock).mockReturnValue(mockGame);

    transport = createMockTransport();
    server = new DedicatedServer({ transport });
    await server.startServer('test.bsp');
  });

  afterEach(() => {
    server.stopServer();
    vi.useRealTimers();
    vi.clearAllMocks();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should initialize the game and start the frame loop', () => {
    expect(createGame).toHaveBeenCalled();
    expect(mockGame.init).toHaveBeenCalled();
    expect(mockGame.spawnWorld).toHaveBeenCalled();

    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(2);
  });

  it('should run the main game loop and process client commands', () => {
    // Use helper to create default frames if needed, or rely on createMockServerClient defaults if updated
    // For now, we still need frames for the dedicated server logic to work properly
    const frames = [];
    for (let i = 0; i < UPDATE_BACKUP; i++) {
        frames.push({
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: {},
            numEntities: 0,
            firstEntity: 0,
            sentTime: 0,
            entities: []
        });
    }

    const fakeClient = createMockServerClient(0, {
        frames: frames as any[],
        lastCmd: { msec: 100, angles: {x: 0, y: 90, z: 0}, buttons: 1, forwardmove: 200, sidemove: 0, upmove: 0, sequence: 1, lightlevel: 0, impulse: 0, serverFrame: 0 },
        state: ClientState.Active,
        edict: { id: 1, classname: 'player' } as any
    });

    // @ts-ignore
    server.svs.clients[0] = fakeClient;

    (mockGame.frame as any).mockClear();
    (mockGame.clientThink as any).mockClear();

    vi.advanceTimersByTime(FRAME_TIME_MS);

    expect(mockGame.clientThink).toHaveBeenCalledWith(fakeClient.edict, fakeClient.lastCmd);
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 2 }));

    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(2);
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 3 }));

    // Test server snapshot creation using helper
    // This serves as a sanity check that the helpers are compatible with the server state
    const snapshot = createServerSnapshot(server.sv, 0);
    expect(snapshot).toBeDefined();
    expect(snapshot.serverTime).toBe(server.sv.time);
  });


  it('should not process commands for clients that are not active', () => {
    const frames = [];
    for (let i = 0; i < UPDATE_BACKUP; i++) {
        frames.push({
            areaBytes: 0,
            areaBits: new Uint8Array(0),
            playerState: {},
            numEntities: 0,
            firstEntity: 0,
            sentTime: 0,
            entities: []
        });
    }

    const fakeClient = createMockServerClient(0, {
        frames: frames as any[],
        state: ClientState.Connected, // Not Active
        edict: { id: 1, classname: 'player' } as any
    });

    // @ts-ignore
    server.svs.clients[0] = fakeClient;

    (mockGame.frame as any).mockClear();
    (mockGame.clientThink as any).mockClear();

    vi.advanceTimersByTime(FRAME_TIME_MS);

    expect(mockGame.clientThink).not.toHaveBeenCalled();
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
  });

  it('should compensate for slow frames (drift compensation)', async () => {
    vi.clearAllTimers();
    (mockGame.frame as any).mockClear();
    server.stopServer();

    transport = createMockTransport();
    server = new DedicatedServer({ transport });
    await server.startServer('test.bsp');

    expect(mockGame.frame).toHaveBeenCalledTimes(1);

    const frameMock2 = vi.fn().mockImplementation(() => {
        const now = Date.now();
        vi.setSystemTime(now + 40);
        return { state: { packetEntities: [], stats: [] } };
    });
    mockGame.frame = frameMock2;

    vi.advanceTimersByTime(100);
    expect(frameMock2).toHaveBeenCalledTimes(1);

    const frameMock3 = vi.fn().mockImplementation(() => {
        const now = Date.now();
        vi.setSystemTime(now + 120);
        return { state: { packetEntities: [], stats: [] } };
    });
    mockGame.frame = frameMock3;

    vi.advanceTimersByTime(59);
    expect(frameMock3).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(frameMock3).toHaveBeenCalledTimes(1);

    const frameMock4 = vi.fn().mockReturnValue({ state: { packetEntities: [], stats: [] } });
    mockGame.frame = frameMock4;

    vi.advanceTimersByTime(1);
    expect(frameMock4).toHaveBeenCalledTimes(1);
  });
});
