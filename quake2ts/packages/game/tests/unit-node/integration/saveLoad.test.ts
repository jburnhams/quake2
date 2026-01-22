import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { type GameExports } from '../../../src/index.js';
import { createSaveFile, parseSaveFile } from '../../../src/save/index.js';
import { RandomGenerator } from '@quake2ts/shared';
import { createTestGame } from '@quake2ts/test-utils';

describe('Save/Load Integration', () => {
  let game: GameExports;

  beforeEach(() => {
    const context = createTestGame({
        config: { gravity: { x: 0, y: 0, z: -800 } }
    });
    game = context.game;
    game.init(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should round-trip save and load game state', () => {
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

    // Basic assertions for save file validity.
    expect(saveFile).toBeDefined();
    expect(saveFile.timestamp).toBe(12345);
    expect(typeof saveFile.timestamp).toBe('number');

    const json = JSON.stringify(saveFile);

    // Verify JSON content presence.
    expect(json).toContain('"timestamp":12345');

    // Reset game state to simulate loading into a fresh session.
    game.init(0);

    // Modify the original entity to ensure we are not just checking the same object reference.
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
