import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { createDefaultSpawnRegistry } from '../../src/entities/spawn.js';
import { createTestContext } from '@quake2ts/test-utils';
import { monster_think } from '../../src/ai/monster.js';
import { RenderFx } from '@quake2ts/shared';
import { Entity } from '../../src/entities/entity.js';

describe('Monster AI - Soldier', () => {
  let system: EntitySystem;
  let registry: any;

  beforeEach(() => {
    // 1. Use createTestContext which provides mocked engine and system
    const testContext = createTestContext();
    system = testContext.entities;

    // Ensure modelIndex returns 1 as expected by the test
    // createTestContext's engine.modelIndex returns 0 by default, so we override it
    vi.spyOn(testContext.engine, 'modelIndex').mockReturnValue(1);

    // 2. Use createDefaultSpawnRegistry with the mocked engine
    registry = createDefaultSpawnRegistry(testContext.engine);

    // Patch targetAwareness with necessary mocks if not already fully mocked by createTestContext
    // createTestContext provides a basic targetAwareness mock, but we might need to enhance it
    if (system.targetAwareness) {
        (system.targetAwareness as any).activePlayers = [];
        (system.targetAwareness as any).monsterAlertedByPlayers = vi.fn().mockReturnValue(null);
        (system.targetAwareness as any).soundClient = vi.fn().mockReturnValue(null);
    }
  });

  it('spawns a soldier with default state', () => {
    const soldier = system.spawn();
    soldier.classname = 'monster_soldier';
    const spawnFunc = registry.get('monster_soldier');
    expect(spawnFunc).toBeDefined();

    const context = {
        keyValues: {},
        entities: system,
        warn: vi.fn(),
        free: vi.fn(),
        health_multiplier: 1.0,
    };

    spawnFunc(soldier, context);

    expect(soldier.health).toBe(20);
    expect(soldier.max_health).toBe(20);
    expect(soldier.classname).toBe('monster_soldier');
    expect(soldier.monsterinfo.current_move).toBeDefined();
    expect(soldier.monsterinfo.current_move?.firstframe).toBe(0);
  });

  it('advances frames in think', () => {
    const soldier = system.spawn();
    soldier.classname = 'monster_soldier';
    const spawnFunc = registry.get('monster_soldier');

    const context = {
        keyValues: {},
        entities: system,
        warn: vi.fn(),
        free: vi.fn(),
        health_multiplier: 1.0,
    };
    spawnFunc(soldier, context);

    system.beginFrame(1.0);

    expect(soldier.frame).toBe(0);

    if (soldier.think) {
        soldier.think(soldier, system);
    }

    expect(soldier.frame).toBe(1);
    expect(soldier.nextthink).toBeGreaterThan(soldier.timestamp);
  });

  it('loops animation', () => {
    const soldier = system.spawn();
    soldier.classname = 'monster_soldier';
    const spawnFunc = registry.get('monster_soldier');
    spawnFunc(soldier, { keyValues: {}, entities: system, warn: vi.fn(), free: vi.fn(), health_multiplier: 1.0 });

    const move = soldier.monsterinfo.current_move!;
    expect(move).toBeDefined();

    // Set frame to last frame
    soldier.frame = move.lastframe;

    system.beginFrame(1.0);
    if (soldier.think) {
        soldier.think(soldier, system);
    }

    expect(soldier.frame).toBe(move.lastframe + 1);

    if (soldier.think) {
        soldier.think(soldier, system);
    }

    expect(soldier.frame).toBe(move.firstframe + 1);
  });
});

describe('monster_think (Freeze Logic)', () => {
  let context: EntitySystem;
  let entity: Entity;

  beforeEach(() => {
    const testContext = createTestContext();
    context = testContext.entities;
    if (context.targetAwareness) {
        (context.targetAwareness as any).activePlayers = [];
        (context.targetAwareness as any).monsterAlertedByPlayers = vi.fn().mockReturnValue(null);
        (context.targetAwareness as any).soundClient = vi.fn().mockReturnValue(null);
    }

    entity = context.spawn();
    entity.inUse = true;
    entity.monsterinfo = {
      current_move: {
        firstframe: 0,
        lastframe: 10,
        frames: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}],
        endfunc: null
      },
      aiflags: 0,
      nextframe: 0,
      scale: 1,
      stand: null,
      walk: null,
      run: null,
      dodge: null,
      attack: null,
      melee: null,
      sight: null,
      idle: null,
      checkattack: null,
      search: null,
      pause_time: 0,
      attack_finished: 0,
      saved_goal: null,
      last_sighting: { x: 0, y: 0, z: 0 },
      trail_time: 0,
      viewheight: 0,
      allow_spawn: null
    };
    entity.frame = 0;
    entity.renderfx = 0;
  });

  it('should apply freeze effect and stop animation when frozen', () => {
    context.timeSeconds = 10;
    entity.monsterinfo!.freeze_time = 15;

    monster_think(entity, context);

    expect((entity.renderfx & RenderFx.ShellBlue)).toBeTruthy();
    expect((entity.renderfx & RenderFx.ShellGreen)).toBeTruthy();
    expect(entity.frame).toBe(0);
    expect(entity.nextthink).toBeGreaterThan(context.timeSeconds);
  });

  it('should clear freeze effect when timer expires', () => {
    context.timeSeconds = 20;
    entity.monsterinfo!.freeze_time = 15;
    entity.renderfx = RenderFx.ShellBlue | RenderFx.ShellGreen;

    monster_think(entity, context);

    expect((entity.renderfx & RenderFx.ShellBlue)).toBeFalsy();
    expect((entity.renderfx & RenderFx.ShellGreen)).toBeFalsy();
    expect(entity.frame).toBe(1);
    expect(entity.monsterinfo!.freeze_time).toBe(0);
  });
});
