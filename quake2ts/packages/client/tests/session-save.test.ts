import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSession, GameSession, SessionOptions } from '../src/session';
import { EngineImports, Renderer, EngineHost, CvarManager, EngineCvar } from '@quake2ts/engine';
import { GameSaveFile, SaveStorage } from '@quake2ts/game';

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

const mockStorage: SaveStorage = {
    save: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue([]),
};

describe('GameSession Save/Load Integration', () => {
  let session: GameSession;

  beforeEach(() => {
    vi.clearAllMocks();
    session = createSession({
      engine: mockEngine,
      mapName: 'base1',
      skill: 1,
      storage: mockStorage
    });
    session.startNewGame('base1');
  });

  it('should save game', async () => {
    const save = await session.saveGame('slot1');
    expect(save).toBeDefined();
    expect(save.map).toBe('base1');
    expect(mockStorage.save).toHaveBeenCalledWith('slot1', expect.any(Object));
  });

  it('should load game', async () => {
    const mockSave: GameSaveFile = {
        map: 'base2',
        difficulty: 2,
        playtimeSeconds: 100,
        timestamp: Date.now(),
        version: 1,
        checksum: 0,
        entities: {
            activeCount: 0,
            world: { classname: 'worldspawn' },
            pool: {
                capacity: 2048,
                nextFree: 1,
                freed: [],
                freeList: [],
                pendingFree: [],
                activeOrder: [0],
                entities: [{
                    index: 0,
                    classname: 'worldspawn',
                    inUse: true,
                    origin: { x: 0, y: 0, z: 0 },
                    // Minimal entity stub
                } as any]
            },
            entities: [],
            thinks: []
        },
        level: {
            timeSeconds: 10,
            frame: 100
        },
        rng: {
            mt: {
                index: 0,
                state: new Array(624).fill(0)
            }
        }
    };

    await session.loadGame(mockSave);
    // map command should be executed
    expect(mockExecuteText).toHaveBeenCalledWith('map base2');
  });

  it('should quick save and load', async () => {
      await session.quickSave();
      expect(mockStorage.save).toHaveBeenCalledWith('quick', expect.any(Object));

      vi.mocked(mockStorage.load).mockResolvedValueOnce({
          map: 'base1',
          difficulty: 1,
          playtimeSeconds: 10,
          timestamp: Date.now(),
          version: 1,
          checksum: 0,
          entities: {
              activeCount: 0,
              world: { classname: 'worldspawn' },
              pool: {
                  capacity: 2048,
                  nextFree: 1,
                  freed: [],
                  freeList: [],
                  pendingFree: [],
                  activeOrder: [0],
                  entities: [{
                      index: 0,
                      classname: 'worldspawn',
                      inUse: true,
                      origin: { x: 0, y: 0, z: 0 },
                  } as any]
              },
              entities: [],
              thinks: []
          },
          level: { timeSeconds: 10, frame: 100 },
          rng: {
              mt: {
                  index: 0,
                  state: new Array(624).fill(0)
              }
          }
      });

      await session.quickLoad();
      expect(mockStorage.load).toHaveBeenCalledWith('quick');
  });

  it('should get save metadata', () => {
      const mockSave: GameSaveFile = {
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 123,
        timestamp: 1000,
        version: 1,
        checksum: 0,
        entities: {
            activeCount: 0,
            world: { classname: 'worldspawn' },
            pool: {
                capacity: 2048,
                nextFree: 1,
                freed: [],
                freeList: [],
                pendingFree: [],
                activeOrder: [0],
                entities: [{
                    index: 0,
                    classname: 'worldspawn',
                    inUse: true,
                    origin: { x: 0, y: 0, z: 0 },
                } as any]
            },
            entities: [],
            thinks: []
        },
        level: { timeSeconds: 10, frame: 100 },
        rng: {
            mt: {
                index: 0,
                state: new Array(624).fill(0)
            }
        }
      };

      const meta = session.getSaveMetadata(mockSave);
      expect(meta.mapName).toBe('base1');
      expect(meta.playtime).toBe(123);
      expect(meta.timestamp).toBe(1000);
  });
});
