import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, GameSession, SessionOptions } from '../src/session';
import { EngineImports, Renderer, EngineHost, CvarManager, EngineCvar } from '@quake2ts/engine';
import { PlayerState } from '@quake2ts/shared';

// Mock dependencies
const mockRenderer = {
  width: 800,
  height: 600,
  trace: vi.fn(),
  begin2D: vi.fn(),
  end2D: vi.fn(),
  renderFrame: vi.fn(),
  registerTexture: vi.fn().mockReturnValue({}),
  drawPic: vi.fn(),
  drawCenterString: vi.fn(),
} as unknown as Renderer;

const mockExecuteText = vi.fn();
const mockCvars = new Map<string, any>();
const mockEngine = {
  trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 }),
  renderer: mockRenderer,
  cmd: { executeText: mockExecuteText },
  assets: {
      loadTexture: vi.fn().mockResolvedValue({}),
      getMap: vi.fn(),
      listFiles: vi.fn().mockReturnValue([])
  },
} as unknown as EngineImports & { renderer: Renderer; cmd?: { executeText(text: string): void } };

describe('GameSession State Queries', () => {
  let session: GameSession;

  beforeEach(() => {
    vi.clearAllMocks();
    session = createSession({
      engine: mockEngine,
      mapName: 'base1',
      skill: 1
    });
    session.startNewGame('base1');
  });

  it('should return paused state', () => {
    expect(session.isPaused()).toBe(false); // Default unpaused
    // Mock host paused state manipulation if possible or assume default
  });

  it('should return map name', () => {
    expect(session.getMapName()).toBe('base1');
  });

  it('should return skill level', () => {
    expect(session.getSkillLevel()).toBe(1);
  });

  it('should return game mode', () => {
    expect(session.getGameMode()).toBe('single');
  });

  it('should return player state (undefined initially/mocked)', () => {
      // It might be undefined until a frame is rendered
      expect(session.getPlayerState()).toBeUndefined();
  });
});
