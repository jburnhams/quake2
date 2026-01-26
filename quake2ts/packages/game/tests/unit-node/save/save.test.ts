import { CvarRegistry } from '@quake2ts/engine';
import { CvarFlags, RandomGenerator } from '@quake2ts/shared';
import { describe, expect, it } from 'vitest';
import { Entity, EntitySystem } from '../../../src/entities/index.js';
import { LevelClock } from '../../../src/level.js';
import { applySaveFile, createSaveFile, parseSaveFile, SAVE_FORMAT_VERSION } from '../../../src/save/save.js';
import { createMockEngine } from '@quake2ts/test-utils';

describe('save/load determinism', () => {
  it('restores entity wiring, timing, and RNG deterministically', () => {
    const mockEngine = createMockEngine();
    // EntitySystem expects trace in engine for some operations, but we can patch it if needed or assume it's not called during basic spawn/link unless collision is active.
    // However, the original test had trace: () => ({})
    // createMockEngine returns { sound, soundIndex, modelIndex, centerprintf }
    // We should add trace stub.
    const engineWithTrace = {
        ...mockEngine,
        trace: () => ({}) as any
    };

    const entitySystem = new EntitySystem(engineWithTrace);
    entitySystem.beginFrame(10);

    const alpha = entitySystem.spawn();
    const beta = entitySystem.spawn();

    alpha.classname = 'monster_soldier';
    alpha.origin = { x: 10, y: 20, z: 30 };
    alpha.target = 'exit';
    alpha.enemy = beta;
    alpha.nextthink = 10.5;
    alpha.health = 75;

    beta.classname = 'misc_banner';
    beta.origin = { x: -4, y: 8, z: 12 };
    beta.goalentity = alpha;
    beta.groundentity = entitySystem.world;
    beta.ideal_yaw = 90;
    beta.nextthink = 10.25;

    entitySystem.finalizeSpawn(alpha);
    entitySystem.finalizeSpawn(beta);
    entitySystem.scheduleThink(alpha, 10.5);
    entitySystem.scheduleThink(beta, 10.25);

    const rng = new RandomGenerator({ seed: 1337 });
    rng.irandomUint32();
    rng.irandomRange(0, 10);
    const rngState = rng.getState();
    const expectedNext = rng.irandomUint32();

    const levelState = {
      frameNumber: 4,
      timeSeconds: 0.1,
      previousTimeSeconds: 0.075,
      deltaSeconds: 0.025,
    } as const;

    const save = createSaveFile({
      map: 'base1',
      difficulty: 2,
      playtimeSeconds: 12,
      levelState,
      entitySystem,
      rngState,
      configstrings: ['models/monsters/soldier/tris.md2'],
    });

    const parsed = parseSaveFile({ ...save, extraTopLevel: 'ignored' });

    const restoredSystem = new EntitySystem(engineWithTrace);
    const restoredClock = new LevelClock();
    const restoredRng = new RandomGenerator({ seed: 7 });

    applySaveFile(parsed, {
      levelClock: restoredClock,
      entitySystem: restoredSystem,
      rng: restoredRng,
    });

    const snapshot = restoredSystem.createSnapshot();
    expect(snapshot.pool).toEqual(save.entities.pool);
    expect(snapshot.thinks).toEqual(save.entities.thinks);
    expect(restoredClock.current).toEqual(levelState);
    expect(restoredRng.irandomUint32()).toBe(expectedNext);

    // Helper to find entity by index
    const findEntity = (sys: EntitySystem, idx: number) => {
        let match: Entity | null = null;
        sys.forEachEntity((e) => { if (e.index === idx) match = e; });
        return match;
    };

    const restoredAlpha = findEntity(restoredSystem, alpha.index)!;
    const restoredBeta = findEntity(restoredSystem, beta.index)!;

    expect(restoredAlpha.enemy).toBe(restoredBeta);
    expect(restoredBeta.goalentity).toBe(restoredAlpha);
    expect(restoredBeta.groundentity).toBe(restoredSystem.world);
    expect(restoredAlpha.target).toBe('exit');
    expect(restoredBeta.ideal_yaw).toBeCloseTo(90);
    expect(restoredAlpha.origin).toEqual(alpha.origin);
    expect(restoredBeta.origin).toEqual(beta.origin);
  });

  it('captures RNG state immutably when creating saves', () => {
    const mockEngine = createMockEngine();
    const engineWithTrace = { ...mockEngine, trace: () => ({}) as any };
    const entitySystem = new EntitySystem(engineWithTrace);
    const rng = new RandomGenerator({ seed: 5 });
    rng.irandomUint32();
    const rngState = rng.getState();
    const expectedStatePrefix = [...rngState.mt.state.slice(0, 3)];

    const save = createSaveFile({
      map: 'base1',
      difficulty: 1,
      playtimeSeconds: 0,
      levelState: { frameNumber: 0, timeSeconds: 0, previousTimeSeconds: 0, deltaSeconds: 0 },
      entitySystem,
      rngState,
    });

    rngState.mt.state = rngState.mt.state.map((value, idx) => (idx === 0 ? value + 1 : value));

    expect(save.rng.mt.state[0]).not.toBe(rngState.mt.state[0]);
    expect(save.rng.mt.state.slice(0, 3)).toEqual(expectedStatePrefix);
  });

  it('parses older or future saves while filling defaults', () => {
    const mockEngine = createMockEngine();
    const engineWithTrace = { ...mockEngine, trace: () => ({}) as any };
    const baseSystem = new EntitySystem(engineWithTrace);
    const baseRng = new RandomGenerator({ seed: 99 }).getState();
    const baseSave = {
      version: SAVE_FORMAT_VERSION,
      timestamp: 123,
      map: 'demo1',
      difficulty: 1,
      playtimeSeconds: 3,
      level: { frameNumber: 1, timeSeconds: 0.025, previousTimeSeconds: 0, deltaSeconds: 0.025 },
      rng: baseRng,
      entities: baseSystem.createSnapshot(),
    } as const;

    const parsed = parseSaveFile({ ...baseSave });
    expect(parsed.gameState).toEqual({});
    expect(parsed.cvars).toEqual([]);
    expect(parsed.configstrings).toEqual([]);

    const future = parseSaveFile({ ...baseSave, version: SAVE_FORMAT_VERSION + 2, unknownField: 'future' });
    expect(future.version).toBe(SAVE_FORMAT_VERSION + 2);

    const registry = new CvarRegistry();
    registry.register({ name: 'sv_gravity', defaultValue: '800', flags: CvarFlags.Archive });
    registry.setValue('sv_gravity', '900');
    const withCvars = createSaveFile({
      map: 'demo1',
      difficulty: 1,
      playtimeSeconds: 3,
      levelState: baseSave.level,
      entitySystem: baseSystem,
      rngState: baseRng,
      cvars: registry,
    });

    expect(() => parseSaveFile({ ...withCvars, version: 0 }, { allowNewerVersion: true })).toThrow();
    expect(() => parseSaveFile({ ...withCvars, version: SAVE_FORMAT_VERSION + 5 }, { allowNewerVersion: false })).toThrow();
  });
});
