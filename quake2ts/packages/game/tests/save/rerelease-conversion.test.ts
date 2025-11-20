import { RandomGenerator } from '@quake2ts/shared';
import { describe, expect, it, test } from 'vitest';
import {
  convertGameSaveToRereleaseLevel,
  convertRereleaseLevelToGameSave,
  convertRereleaseSaveToGameSave,
  parseRereleaseSave,
  serializeRereleaseSave,
} from '../../src/save/index.js';
import { EntitySystem } from '../../src/entities/index.js';
import { LevelClock } from '../../src/level.js';
import { createSaveFile, SAVE_FORMAT_VERSION } from '../../src/save/save.js';

function createBasicSnapshot() {
  const system = new EntitySystem();
  system.beginFrame(2.5);
  const crate = system.spawn();
  crate.classname = 'misc_crate';
  crate.origin = { x: 4, y: -2, z: 8 };
  crate.velocity = { x: 1, y: 2, z: 3 };
  const soldier = system.spawn();
  soldier.classname = 'monster_soldier';
  soldier.enemy = crate;
  soldier.ideal_yaw = 90;
  soldier.health = 60;
  system.finalizeSpawn(crate);
  system.finalizeSpawn(soldier);
  return { system, crate, soldier };
}

describe('rerelease save conversions', () => {
  it('imports rerelease level saves into deterministic snapshots', () => {
    const rngState = new RandomGenerator({ seed: 1234 }).getState();
    const rerelease = parseRereleaseSave({
      save_version: 5,
      level: { mapname: 'fact1', time: 10.5, framenum: 420, frametime: 0.05, maxentities: 8 },
      entities: {
        '0': { classname: 'worldspawn', inuse: true, gravity: 800 },
        '2': { classname: 'info_player_start', inuse: true, origin: [0, 16, 24], angles: [0, 90, 0] },
        '5': { classname: 'misc_crate', inuse: false, origin: [1, 2, 3] },
      },
    });

    const save = convertRereleaseLevelToGameSave(rerelease, {
      rngState,
      timestamp: 1,
      defaultDifficulty: 2,
      defaultPlaytimeSeconds: 12,
      configstrings: ['models/monsters/soldier/tris.md2'],
    });

    expect(save.version).toBe(SAVE_FORMAT_VERSION);
    expect(save.map).toBe('fact1');
    expect(save.playtimeSeconds).toBe(12);
    expect(save.level).toEqual({ frameNumber: 420, timeSeconds: 10.5, previousTimeSeconds: 10.45, deltaSeconds: 0.05 });
    expect(save.entities.pool).toEqual({ capacity: 8, activeOrder: [0, 2], freeList: [1, 3, 4, 5, 6, 7], pendingFree: [] });
    expect(save.entities.entities.find((entry) => entry.index === 2)?.fields.origin).toEqual([0, 16, 24]);
    expect(save.entities.entities.find((entry) => entry.index === 0)?.fields.classname).toBe('worldspawn');
    expect(save.configstrings).toEqual(['models/monsters/soldier/tris.md2']);
  });

  it('refuses to convert rerelease game saves until client data is mapped', () => {
    const rerelease = parseRereleaseSave({
      save_version: 1,
      game: { mapname: 'base1', maxclients: 1 },
      clients: [{}],
    });

    expect(() => convertRereleaseSaveToGameSave(rerelease)).toThrow('not currently supported');
  });

  test.skip('skipped TODO - exports snapshots back to rerelease-shaped JSON deterministically', () => {
    const { system, crate, soldier } = createBasicSnapshot();
    const clock = new LevelClock();
    const levelState = { frameNumber: 2, timeSeconds: 0.05, previousTimeSeconds: 0.025, deltaSeconds: 0.025 } as const;
    clock.restore(levelState);
    const rng = new RandomGenerator({ seed: 77 });

    const save = createSaveFile({
      map: 'base1',
      difficulty: 1,
      playtimeSeconds: 1,
      levelState,
      entitySystem: system,
      rngState: rng.getState(),
    });

    const rerelease = convertGameSaveToRereleaseLevel(save);
    const json = serializeRereleaseSave(rerelease);

    expect(json).toEqual({
      save_version: SAVE_FORMAT_VERSION,
      level: { mapname: 'base1', time: levelState.timeSeconds, framenum: levelState.frameNumber, frametime: levelState.deltaSeconds },
      entities: {
        '0': expect.objectContaining({ inuse: true, classname: 'worldspawn' }),
        [crate.index.toString(10)]: expect.objectContaining({ classname: 'misc_crate', origin: [4, -2, 8], velocity: [1, 2, 3] }),
        [soldier.index.toString(10)]: expect.objectContaining({ classname: 'monster_soldier', enemy: crate.index, ideal_yaw: 90, health: 60 }),
      },
    });

    const roundTrip = convertRereleaseLevelToGameSave(rerelease, { timestamp: save.timestamp, defaultPlaytimeSeconds: save.playtimeSeconds });
    expect(roundTrip.entities.pool.activeOrder).toEqual(save.entities.pool.activeOrder);
    expect(roundTrip.entities.entities.find((entry) => entry.index === soldier.index)?.fields.enemy).toBe(crate.index);
  });
});
