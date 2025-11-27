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

    mockGame = {
      init: vi.fn(),
      shutdown: vi.fn(),
      spawnWorld: vi.fn(),
      clientBegin: vi.fn(() => ({ id: 1, classname: 'player' })),
      clientThink: vi.fn(),
      frame: vi.fn().mockReturnValue({ state: { packetEntities: [] } }),
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
    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
  });

  it('should run the main game loop and process client commands', () => {
    const fakeCmd: UserCommand = { msec: 100, angles: {x: 0, y: 90, z: 0}, buttons: 1, forwardmove: 200, sidemove: 0, upmove: 0 };
    const fakeClient: Client = {
      index: 0,
      state: ClientState.Active,
      edict: { id: 1, classname: 'player' },
      lastCmd: fakeCmd,
      net: { send: vi.fn() },
      messageQueue: [] // Added messageQueue
    } as unknown as Client;

    // @ts-ignore - Access private property for testing
    server.svs.clients[0] = fakeClient;

    // Advance time by one frame
    vi.advanceTimersByTime(FRAME_TIME_MS);

    // Verify clientThink was called for the active client
    expect(mockGame.clientThink).toHaveBeenCalledWith(fakeClient.edict, fakeClient.lastCmd);

    // Verify frame was called
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 1 }));

    // Advance time again
    vi.advanceTimersByTime(FRAME_TIME_MS);
    expect(mockGame.frame).toHaveBeenCalledTimes(2);
    expect(mockGame.frame).toHaveBeenCalledWith(expect.objectContaining({ frame: 2 }));
  });

  it('should not process commands for clients that are not active', () => {
    const fakeClient: Client = {
      index: 0,
      state: ClientState.Connected, // Not Active
      edict: { id: 1, classname: 'player' },
      lastCmd: {} as UserCommand,
      net: { send: vi.fn() },
      messageQueue: [] // Added messageQueue
    } as unknown as Client;

    // @ts-ignore - Access private property for testing
    server.svs.clients[0] = fakeClient;

    // Advance time
    vi.advanceTimersByTime(FRAME_TIME_MS);

    // Verify clientThink was NOT called
    expect(mockGame.clientThink).not.toHaveBeenCalled();
    // Verify frame was still called
    expect(mockGame.frame).toHaveBeenCalledTimes(1);
  });
});
