import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, GameSession, SessionOptions } from '../src/session';
import * as ClientModule from '../src/index';
import * as GameModule from '@quake2ts/game';
import * as EngineModule from '@quake2ts/engine';
import { Vec3 } from '@quake2ts/shared';

// Mock dependencies
vi.mock('../src/index', () => ({
  createClient: vi.fn(() => ({
    init: vi.fn(),
    render: vi.fn(),
    shutdown: vi.fn(),
    ParseCenterPrint: vi.fn(),
    ParseConfigString: vi.fn(),
  })),
}));

vi.mock('@quake2ts/game', () => ({
  createGame: vi.fn(() => ({
    spawnWorld: vi.fn(),
    init: vi.fn(() => ({})),
    shutdown: vi.fn(),
    frame: vi.fn(),
  })),
}));

vi.mock('@quake2ts/engine', () => ({
  EngineHost: vi.fn(function(this: any) {
    this.start = vi.fn();
    this.stop = vi.fn();
  }),
}));

describe('GameSession', () => {
  let session: GameSession;
  let mockEngine: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEngine = {
      trace: vi.fn(() => ({
          allsolid: false,
          startsolid: false,
          fraction: 1,
          endpos: { x: 0, y: 0, z: 0 },
          plane: null,
          surfaceFlags: 0,
          contents: 0,
          ent: null
      })),
      renderer: {},
    };
  });

  it('should create a session', () => {
    session = createSession({ engine: mockEngine });
    expect(session).toBeInstanceOf(GameSession);
  });

  it('should start a new game', () => {
    session = createSession({ engine: mockEngine });
    session.startNewGame('base1', 1);

    expect(GameModule.createGame).toHaveBeenCalled();
    expect(ClientModule.createClient).toHaveBeenCalled();
    expect(EngineModule.EngineHost).toHaveBeenCalled();

    // Check if host.start() was called
    const host = session.getHost();
    expect(host?.start).toHaveBeenCalled();

    // Check if spawnWorld was called
    const game = session.getGame();
    expect(game?.spawnWorld).toHaveBeenCalled();
  });

  it('should shutdown properly', () => {
    session = createSession({ engine: mockEngine });
    session.startNewGame('base1', 1);

    const host = session.getHost();
    const game = session.getGame();
    const client = session.getClient(); // This is just the interface, the mocked function is createClient

    session.shutdown();

    expect(host?.stop).toHaveBeenCalled();
  });

  it('should adapt trace calls correctly', () => {
      // We need to verify that the trace adapter passed to createGame calls engine.trace
      session = createSession({ engine: mockEngine });
      session.startNewGame('base1', 1);

      // Get the trace adapter passed to createGame
      const createGameCalls = (GameModule.createGame as any).mock.calls;
      const gameImports = createGameCalls[0][0];

      const start: Vec3 = { x: 0, y: 0, z: 0 };
      const end: Vec3 = { x: 10, y: 0, z: 0 };

      gameImports.trace(start, null, null, end, null, 0);

      expect(mockEngine.trace).toHaveBeenCalledWith(start, end, undefined, undefined);
  });
});
