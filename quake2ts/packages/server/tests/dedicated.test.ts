import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated.js';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState, Client } from '../src/client.js';
import { UserCommand, UPDATE_BACKUP } from '@quake2ts/shared';
import { MockTransport } from './mocks/transport.js';

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

// Helper to create a proper mock client
const createMockClient = (index: number): Client => {
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

  return {
    index,
    state: ClientState.Active,
    edict: { id: 1, classname: 'player' },
    lastCmd: { msec: 0, angles: {x: 0, y: 0, z: 0}, buttons: 0, forwardmove: 0, sidemove: 0, upmove: 0 },
    net: { send: vi.fn() },
    netchan: {
      transmit: vi.fn().mockReturnValue(new Uint8Array(0)),
      process: vi.fn().mockReturnValue(new Uint8Array(0)),
      writeReliableByte: vi.fn(),
      writeReliableShort: vi.fn(),
      writeReliableString: vi.fn(),
      writeReliableLong: vi.fn(),
    },
    messageQueue: [],
    lastPacketEntities: [],
    frames: frames,
    lastFrame: 0,
    commandQueue: [],
    lastCommandTime: Date.now(),
    commandCount: 0
  } as unknown as Client;
};

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

    mockGame = {
      init: vi.fn(),
      shutdown: vi.fn(),
      spawnWorld: vi.fn(),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' })),
      clientThink: vi.fn(),
      frame: vi.fn().mockReturnValue({
        state: {
          packetEntities: [],
          gravity: { x: 0, y: 0, z: -800 },
          origin: { x: 0, y: 0, z: 0 },
          velocity: { x: 0, y: 0, z: 0 },
          viewangles: { x: 0, y: 0, z: 0 },
          deltaAngles: { x: 0, y: 0, z: 0 },
          kick_angles: { x: 0, y: 0, z: 0 },
          gunoffset: { x: 0, y: 0, z: 0 },
          gunangles: { x: 0, y: 0, z: 0 },
          blend: [0, 0, 0, 0],
          stats: new Array(32).fill(0),
          pmFlags: 0,
          pmType: 0,
          gunindex: 0
        }
      }),
      entities: {
          forEachEntity: vi.fn(),
          getByIndex: vi.fn()
      },
      clientConnect: vi.fn().mockReturnValue(true),
      clientDisconnect: vi.fn(),
    } as unknown as GameExports;

    (createGame as vi.Mock).mockReturnValue(mockGame);

    transport = new MockTransport();
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
    const fakeClient = createMockClient(0);
    fakeClient.lastCmd = { msec: 100, angles: {x: 0, y: 90, z: 0}, buttons: 1, forwardmove: 200, sidemove: 0, upmove: 0 };

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
  });

  it('should not process commands for clients that are not active', () => {
    const fakeClient = createMockClient(0);
    fakeClient.state = ClientState.Connected;

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

    transport = new MockTransport();
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
