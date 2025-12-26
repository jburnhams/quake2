import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameSession, SessionOptions, createSession } from '../src/session.js';
import { EngineImports, Renderer, EngineHost } from '@quake2ts/engine';
import { GameExports, EntitySystem, GameSaveFile, SaveStorage } from '@quake2ts/game';
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
      createSave: vi.fn((mapName, difficulty, playtime) => ({
          version: 2,
          timestamp: Date.now(),
          map: mapName,
          difficulty: difficulty,
          playtimeSeconds: playtime,
          gameState: {},
          level: { frameNumber: 100 },
          rng: { mt: { index: 0, state: [] } },
          entities: { entities: [] },
          cvars: [],
          configstrings: [],
          checksum: 123456
      })),
      loadSave: vi.fn()
    })),
    SaveStorage: class {
        constructor() {
            return {
                save: vi.fn().mockResolvedValue({ id: 'slot1', name: 'Slot 1' }),
                load: vi.fn().mockResolvedValue({
                     version: 2,
                     map: 'base1',
                     difficulty: 2,
                     playtimeSeconds: 123.45,
                     gameState: {},
                     level: { frameNumber: 100 },
                     rng: { mt: { index: 0, state: [] } },
                     entities: { entities: [] },
                     cvars: [],
                     configstrings: []
                }),
                quickSave: vi.fn().mockResolvedValue({ id: 'quicksave', name: 'Quick Save' }),
                quickLoad: vi.fn().mockResolvedValue({
                     version: 2,
                     map: 'base1',
                     difficulty: 2,
                     playtimeSeconds: 123.45,
                     gameState: {},
                     level: { frameNumber: 100 },
                     rng: { mt: { index: 0, state: [] } },
                     entities: { entities: [] },
                     cvars: [],
                     configstrings: []
                }),
                list: vi.fn().mockResolvedValue([{ id: 'slot1', name: 'Slot 1' }, { id: 'quicksave', name: 'Quick Save' }])
            };
        }
    }
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
        EngineHost: class {
            constructor() {
                return {
                    start: vi.fn(),
                    stop: vi.fn(),
                    paused: true
                };
            }
        }
    };
});


describe('GameSession Save/Load', () => {
  let session: GameSession;
  let mockEngine: any;
  let saveStorageMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
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

    // Access the mocked storage instance
    saveStorageMock = session.getSaveStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should save game to slot', async () => {
    const slotName = 'mysave';
    const saveData = await session.saveGame(slotName);

    expect(saveData.map).toBe('base1');
    expect(saveData.playtimeSeconds).toBe(123.45);
    expect(saveStorageMock.save).toHaveBeenCalledWith(slotName, saveData);
  });

  it('should get save metadata', async () => {
    const slotName = 'mysave';
    const saveData = await session.saveGame(slotName);
    const metadata = session.getSaveMetadata(saveData);

    expect(metadata.mapName).toBe('base1');
    expect(metadata.playtimeSeconds).toBe(123.45);
    expect(metadata.difficulty).toBe(2);
    expect(metadata.timestamp).toBeDefined();
  });

  it('should quick save', async () => {
    await session.quickSave();
    expect(saveStorageMock.quickSave).toHaveBeenCalled();
  });

  it('should quick load', async () => {
    await session.quickLoad();
    expect(saveStorageMock.quickLoad).toHaveBeenCalled();
    expect(mockEngine.cmd.executeText).toHaveBeenCalledWith('map base1');
  });

  it('should check for quick save existence', async () => {
      const exists = await session.hasQuickSave();
      expect(exists).toBe(true);
      expect(saveStorageMock.list).toHaveBeenCalled();
  });

  it('should load game from data', async () => {
     const saveData: any = {
         version: 2,
         map: 'base2',
         difficulty: 1,
         playtimeSeconds: 100,
         gameState: {},
         level: { frameNumber: 100 },
         rng: { mt: { index: 0, state: [] } },
         entities: { entities: [] },
         cvars: [],
         configstrings: []
     };

     await session.loadGame(saveData);
     expect(mockEngine.cmd.executeText).toHaveBeenCalledWith('map base2');
  });
});
