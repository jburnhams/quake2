import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { setupBrowserEnvironment } from '@quake2ts/tests/src/setup.js';
import { createGame, type GameExports } from '../../src/index.js';
import { createSaveFile, parseSaveFile } from '../../src/save/index.js';
import type { GameImports } from '../../src/imports.js';
import { RandomGenerator } from '@quake2ts/shared';

// Mock GameImports
const createMockGameImports = (): GameImports => ({
  trace: vi.fn(() => ({ fraction: 1.0, allsolid: false, startsolid: false, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } })),
  pointcontents: vi.fn(() => 0),
  setmodel: vi.fn(),
  configstring: vi.fn(),
  modelindex: vi.fn(() => 1),
  soundindex: vi.fn(() => 1),
  imageindex: vi.fn(() => 1),
  linkentity: vi.fn(),
  unlinkentity: vi.fn(),
  multicast: vi.fn(),
  unicast: vi.fn(),
  sound: vi.fn(),
  centerprintf: vi.fn(),
  bprint: vi.fn(),
  dprint: vi.fn(),
  error: vi.fn(),
  cvar_get: vi.fn(),
  cvar_set: vi.fn(),
  cvar_forceset: vi.fn(),
  argc: vi.fn(() => 0),
  argv: vi.fn(() => ''),
  args: vi.fn(() => ''),
  positiondms: vi.fn()
} as unknown as GameImports);

describe('Save/Load Integration', () => {
  let game: GameExports;
  let imports: GameImports;

  beforeEach(() => {
    setupBrowserEnvironment();
    imports = createMockGameImports();
    const mockEngine = {
        trace: vi.fn(),
    };

    game = createGame(imports, mockEngine as any, { gravity: { x: 0, y: 0, z: -800 } });
    game.init(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skip('should round-trip save and load game state', () => {
    game.spawnWorld();
    const ent = game.entities.spawn();
    ent.classname = 'monster_soldier';
    ent.origin = { x: 100, y: 200, z: 300 };
    ent.health = 50;

    game.entities.beginFrame(1.0);
    game.entities.runFrame();

    const rngState = new RandomGenerator().getState();
    const levelState = {
        frameNumber: 1,
        timeSeconds: 1.0,
        previousTimeSeconds: 0,
        deltaSeconds: 0.1
    };

    const saveFile = createSaveFile({
        map: 'base1',
        difficulty: 1,
        playtimeSeconds: 10,
        levelState,
        entitySystem: game.entities,
        rngState,
        timestamp: 12345,
        player: undefined
    });

    // Debug assertions
    expect(saveFile).toBeDefined();
    expect(saveFile.timestamp).toBe(12345);
    expect(typeof saveFile.timestamp).toBe('number');

    const json = JSON.stringify({ save: saveFile });

    // Verify JSON content
    expect(json).toContain('"timestamp":12345');

    game.init(0);
    ent.origin.x = 999;

    const loadedFile = parseSaveFile(json);
    game.entities.restore(loadedFile.entities);

    const restoredEnt = game.entities.find(e => e.index === ent.index);
    expect(restoredEnt).toBeDefined();
    expect(restoredEnt?.origin.x).toBe(100);
    expect(restoredEnt?.origin.y).toBe(200);
    expect(restoredEnt?.health).toBe(50);
  });
});
