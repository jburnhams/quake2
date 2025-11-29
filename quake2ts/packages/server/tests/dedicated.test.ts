import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated';
import { createGame, GameExports } from '@quake2ts/game';
import { ClientState, Client } from '../src/client';
import { UserCommand } from '@quake2ts/shared';

// Mock dependencies
vi.mock('ws');
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(Buffer.from([0])),
  },
}));
vi.mock('@quake2ts/engine', () => ({
  parseBsp: vi.fn().mockReturnValue({}),
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

  beforeEach(async () => {
    vi.useFakeTimers();

    // Setup mock game with complete snapshot return to avoid errors in DedicatedServer
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
      }
    } as unknown as GameExports;

    (createGame as vi.Mock).mockReturnValue(mockGame);

    server = new DedicatedServer();
    await server.start('test.bsp');
  });

  afterEach(() => {
    server.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize the game and start the frame loop', () => {
    expect(createGame).toHaveBeenCalled();
    expect(mockGame.init).toHaveBeenCalled();
    expect(mockGame.spawnWorld).toHaveBeenCalled();

    // Check if the loop has started by advancing time
    // start() calls runFrame() immediately (1st call)
    // Advance 100ms -> timeout fires -> runFrame() (2nd call)
    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(2);
  });

  it('should run the main game loop and process client commands', () => {
    const fakeCmd: UserCommand = { msec: 100, angles: {x: 0, y: 90, z: 0}, buttons: 1, forwardmove: 200, sidemove: 0, upmove: 0 };
    const fakeClient: Client = {
      index: 0,
      state: ClientState.Active,
      edict: { id: 1, classname: 'player' },
      lastCmd: fakeCmd,
      net: { send: vi.fn() },
      messageQueue: [],
      lastPacketEntities: []
    } as unknown as Client;

    // @ts-ignore - Access private property for testing
    server.svs.clients[0] = fakeClient;

    // Clear previous calls from start()
    (mockGame.frame as any).mockClear();
    (mockGame.clientThink as any).mockClear();

    // Advance time by one frame
    vi.advanceTimersByTime(FRAME_TIME_MS);

    // Verify clientThink was called for the active client
    expect(mockGame.clientThink).toHaveBeenCalledWith(fakeClient.edict, fakeClient.lastCmd);

    // Verify frame was called
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
    // Since we cleared mocks, and start() ran frame 1, this should be frame 2
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 2 }));

    // Advance time again
    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(2);
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 3 }));
  });

  it('should not process commands for clients that are not active', () => {
    const fakeClient: Client = {
      index: 0,
      state: ClientState.Connected, // Not Active
      edict: { id: 1, classname: 'player' },
      lastCmd: {} as UserCommand,
      net: { send: vi.fn() },
      messageQueue: [],
      lastPacketEntities: []
    } as unknown as Client;

    // @ts-ignore - Access private property for testing
    server.svs.clients[0] = fakeClient;

    (mockGame.frame as any).mockClear();
    (mockGame.clientThink as any).mockClear();

    // Advance time
    vi.advanceTimersByTime(FRAME_TIME_MS);

    // Verify clientThink was NOT called
    expect(mockGame.clientThink).not.toHaveBeenCalled();
    // Verify frame was still called
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
  });

  it('should compensate for slow frames (drift compensation)', async () => {
    // 1. Reset server and timers for clean state
    vi.clearAllTimers();
    (mockGame.frame as any).mockClear();
    server.stop();
    server = new DedicatedServer();
    await server.start('test.bsp');

    // Frame 1 executed immediately.
    expect(mockGame.frame).toHaveBeenCalledTimes(1);

    // Frame 2 scheduled in 100ms.

    // Prepare Frame 2: simulate taking 40ms by setting system time
    const frameMock2 = vi.fn().mockImplementation(() => {
        // Advance clock by 40ms WITHOUT triggering other timers
        const now = Date.now();
        vi.setSystemTime(now + 40);
        return { state: { packetEntities: [], stats: [] } };
    });
    mockGame.frame = frameMock2;

    // Advance 100ms to trigger Frame 2
    vi.advanceTimersByTime(100);

    expect(frameMock2).toHaveBeenCalledTimes(1);

    // Frame 2 logic:
    // Start = T
    // frame() sets Time = T + 40
    // End = T + 40
    // Elapsed = 40
    // Sleep = 100 - 40 = 60
    // Frame 3 scheduled in 60ms

    // Prepare Frame 3: simulate taking 120ms (overrun)
    const frameMock3 = vi.fn().mockImplementation(() => {
        const now = Date.now();
        vi.setSystemTime(now + 120);
        return { state: { packetEntities: [], stats: [] } };
    });
    mockGame.frame = frameMock3;

    // Advance 59ms -> Frame 3 NOT run
    vi.advanceTimersByTime(59);
    expect(frameMock3).toHaveBeenCalledTimes(0);

    // Advance 1ms -> Frame 3 run
    vi.advanceTimersByTime(1);
    expect(frameMock3).toHaveBeenCalledTimes(1);

    // Frame 3 logic:
    // Start = T_start
    // frame() sets Time = T_start + 120
    // Elapsed = 120
    // Sleep = max(0, 100 - 120) = 0
    // Frame 4 scheduled in 0ms (immediate)

    // Prepare Frame 4: normal
    const frameMock4 = vi.fn().mockReturnValue({ state: { packetEntities: [], stats: [] } });
    mockGame.frame = frameMock4;

    // Advance minimal time to trigger immediate timeout
    vi.advanceTimersByTime(1);
    expect(frameMock4).toHaveBeenCalledTimes(1);
  });
});
