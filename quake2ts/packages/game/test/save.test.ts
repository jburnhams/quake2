import { CvarRegistry } from '@quake2ts/engine';
import { CvarFlags, RandomGenerator } from '@quake2ts/shared';
import { describe, expect, it } from 'vitest';
import {
  EntitySystem,
  MoveType,
  Solid,
  type EntitySystemSnapshot,
} from '../src/entities/index.js';
import { LevelClock, type LevelFrameState } from '../src/level.js';
import { SAVE_FORMAT_VERSION, applySaveFile, createSaveFile, parseSaveFile } from '../src/save/save.js';
import type { GameEngine } from '../src/index.js';

const mockEngine: GameEngine = {
  trace: () => ({}),
};

function collectSnapshot(system: EntitySystem): EntitySystemSnapshot {
  return system.createSnapshot();
}

describe('EntitySystem snapshots', () => {
  it('round-trips entity fields, references, and free list order', () => {
    const system = new EntitySystem(mockEngine, undefined, undefined, 6);
    system.beginFrame(0.25);

    const enemy = system.spawn();
    enemy.classname = 'grunt';
    enemy.origin = { x: 1, y: 2, z: 3 };
    enemy.angles = { x: 10, y: 20, z: 30 };

    const player = system.spawn();
    player.classname = 'player';
    player.movetype = MoveType.Walk;
    player.solid = Solid.BoundingBox;
    player.enemy = enemy;
    player.groundentity = enemy;

    system.scheduleThink(player, 0.5);

    const freed = system.spawn();
    system.free(freed);
    system.runFrame();

    const snapshot = collectSnapshot(system);

    const restored = new EntitySystem(mockEngine, undefined, undefined, 6);
    restored.restore(snapshot);

    expect(restored.activeCount).toBe(system.activeCount);
    const restoredSnapshot = collectSnapshot(restored);
    expect(restoredSnapshot).toEqual(snapshot);

    const next = restored.spawn();
    expect(next.index).toBe(freed.index);

    restored.beginFrame(0.5);
    let thinkCount = 0;
    restored.forEachEntity((entity) => {
      if (entity.classname === 'player') {
        entity.think = () => {
          thinkCount += 1;
        };
      }
    });
    restored.runFrame();
    expect(thinkCount).toBe(1);
  });

  it('preserves inventory contents across snapshots', () => {
    const system = new EntitySystem(mockEngine, undefined, undefined, 3);
    system.beginFrame(0.1);

    const player = system.spawn();
    player.classname = 'player';
    player.inventory['key_data_cd'] = 2;
    player.inventory['key_security'] = 1;

    const snapshot = collectSnapshot(system);

    const restored = new EntitySystem(mockEngine, undefined, undefined, 3);
    restored.restore(snapshot);

    let restoredPlayer: typeof player | null = null;
    restored.forEachEntity((entity) => {
      if (entity.classname === 'player') {
        restoredPlayer = entity;
      }
    });

    expect(restoredPlayer).not.toBeNull();
    expect(restoredPlayer?.inventory).toEqual({
      key_data_cd: 2,
      key_security: 1,
    });
  });
});

describe('Game save files', () => {
  it('captures and restores level, RNG, cvars, and entity state', () => {
    const levelState: LevelFrameState = {
      frameNumber: 10,
      timeSeconds: 2.5,
      previousTimeSeconds: 2.475,
      deltaSeconds: 0.025,
    };

    const entities = new EntitySystem(mockEngine, undefined, undefined, 5);
    entities.beginFrame(levelState.timeSeconds);
    const target = entities.spawn();
    target.classname = 'target_dummy';
    target.health = 75;

    const rng = new RandomGenerator({ seed: 7 });
    rng.irandomUint32();
    const rngState = rng.getState();
    const expectedSequenceGenerator = new RandomGenerator();
    expectedSequenceGenerator.setState(rngState);
    const expectedSequence = [
      expectedSequenceGenerator.irandomUint32(),
      expectedSequenceGenerator.irandomUint32(),
    ];

    const cvars = new CvarRegistry();
    cvars.register({ name: 's_musicvolume', defaultValue: '0.5', flags: CvarFlags.Archive });
    cvars.setValue('s_musicvolume', '0.2');
    cvars.register({ name: 'ui_language', defaultValue: 'en', flags: CvarFlags.None });

    const save = createSaveFile({
      map: 'base1',
      difficulty: 2,
      playtimeSeconds: 123,
      levelState,
      entitySystem: entities,
      rngState,
      configstrings: ['player.md2'],
      cvars,
      gameState: { note: 'checkpoint' },
      timestamp: 1000,
    });

    expect(save.version).toBeGreaterThan(0);
    expect(save.configstrings).toEqual(['player.md2']);
    expect(save.gameState).toEqual({ note: 'checkpoint' });

    const restoredEntities = new EntitySystem(mockEngine, undefined, undefined, 5);
    const restoredLevel = new LevelClock();
    restoredLevel.start(0);
    const restoredRng = new RandomGenerator({ seed: 999 });
    const restoredCvars = new CvarRegistry();

    applySaveFile(save, {
      levelClock: restoredLevel,
      entitySystem: restoredEntities,
      rng: restoredRng,
      cvars: restoredCvars,
    });

    expect(restoredLevel.current).toEqual(levelState);
    expect(restoredEntities.createSnapshot()).toEqual(save.entities);
    expect([restoredRng.irandomUint32(), restoredRng.irandomUint32()]).toEqual(expectedSequence);

    const savedMusic = restoredCvars.get('s_musicvolume');
    expect(savedMusic?.string).toBe('0.2');
    expect(savedMusic?.flags).toBe(CvarFlags.Archive);
    expect(restoredCvars.get('ui_language')).toBeUndefined();
  });

  it('parses serialized save JSON with validation and defaults', () => {
    const levelState: LevelFrameState = {
      frameNumber: 1,
      timeSeconds: 0.25,
      previousTimeSeconds: 0.225,
      deltaSeconds: 0.025,
    };

    const entities = new EntitySystem(mockEngine, undefined, undefined, 3);
    entities.beginFrame(levelState.timeSeconds);
    const first = entities.spawn();
    first.classname = 'worldspawn';

    const rng = new RandomGenerator({ seed: 123 });
    rng.irandomUint32();
    const rngState = rng.getState();

    const save = createSaveFile({
      map: 'intro',
      difficulty: 1,
      playtimeSeconds: 10,
      levelState,
      entitySystem: entities,
      rngState,
      configstrings: ['world'],
      gameState: { foo: 'bar' },
    });

    const serialized = JSON.stringify({
      ...save,
      gameState: undefined,
      configstrings: undefined,
      cvars: undefined,
      extraField: 'ignored',
    });

    const parsed = parseSaveFile(serialized);
    expect(parsed.version).toBe(SAVE_FORMAT_VERSION);
    expect(parsed.configstrings).toEqual([]);
    expect(parsed.cvars).toEqual([]);
    expect(parsed.gameState).toEqual({});
    expect(parsed.entities).toEqual(save.entities);
    expect(parsed.rng).toEqual(save.rng);
  });

  it('rejects unsupported versions and malformed structures', () => {
    const entities = new EntitySystem(mockEngine, undefined, undefined, 2);
    entities.beginFrame(0);
    const rng = new RandomGenerator({ seed: 5 });

    const valid = createSaveFile({
      map: 'base1',
      difficulty: 2,
      playtimeSeconds: 5,
      levelState: { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 },
      entitySystem: entities,
      rngState: rng.getState(),
    });

    expect(parseSaveFile({ ...valid, version: 99 }).version).toBe(99);
    expect(() => parseSaveFile({ ...valid, version: 99 }, { allowNewerVersion: false })).toThrow(
      'newer than supported',
    );
    expect(() => parseSaveFile({ ...valid, level: null as unknown as LevelFrameState })).toThrow();
    expect(() =>
      parseSaveFile({
        ...valid,
        entities: { ...valid.entities, pool: { capacity: 'bad' } },
      }),
    ).toThrow();
  });
});
