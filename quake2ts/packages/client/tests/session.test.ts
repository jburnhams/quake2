import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSession, SessionOptions, createSession } from '../src/session.js';
import { EngineImports, Renderer, EngineHost } from '@quake2ts/engine';
import { GameExports, EntitySystem } from '@quake2ts/game';
import { ClientExports } from '../src/index.js';

// Mocks
vi.mock('@quake2ts/game', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    createGame: vi.fn(() => ({
      spawnWorld: vi.fn(),
      time: 123.45,
      deathmatch: false,
      skill: 2,
      coop: false,
      entities: {
        level: {
          mapname: 'base1'
        }
      } as any,
      loadSave: vi.fn()
    })),
  };
});

vi.mock('../src/index.js', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        createClient: vi.fn(() => ({
            init: vi.fn(),
            render: vi.fn(),
            shutdown: vi.fn(),
            ParseCenterPrint: vi.fn(),
            ParseConfigString: vi.fn(),
            lastRendered: {
                origin: { x: 10, y: 20, z: 30 },
                velocity: { x: 0, y: 0, z: 0 },
                viewAngles: { x: 0, y: 0, z: 0 },
                health: 100
            }
        })),
    };
});

vi.mock('@quake2ts/engine', () => {
    return {
        EngineHost: vi.fn().mockImplementation(() => ({
            start: vi.fn(),
            stop: vi.fn(),
            paused: true
        }))
    };
});


describe('GameSession State Queries', () => {
  let session: GameSession;
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = {
      trace: vi.fn(() => ({ fraction: 1, endpos: { x: 0, y: 0, z: 0 } })),
      cmd: { executeText: vi.fn() },
      renderer: {}
    };

    const options: SessionOptions = {
      mapName: 'base1',
      skill: 2,
      engine: mockEngine
    };

    session = createSession(options);
    session.startNewGame('base1', 2);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return player state from client', () => {
    const state = session.getPlayerState();
    expect(state).toBeDefined();
    expect(state?.origin).toEqual({ x: 10, y: 20, z: 30 });
  });

  it('should return game time from game', () => {
    const time = session.getGameTime();
    expect(time).toBe(123.45);
  });

  it('should return paused state from host', () => {
    const paused = session.isPaused();
    expect(paused).toBe(true);
  });

  it('should return skill level from game', () => {
    const skill = session.getSkillLevel();
    expect(skill).toBe(2);
  });

  it('should return map name from game level', () => {
    const mapName = session.getMapName();
    expect(mapName).toBe('base1');
  });

  it('should return game mode', () => {
    const mode = session.getGameMode();
    expect(mode).toBe('single');
  });
});
