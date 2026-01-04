
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { createDefaultSpawnRegistry } from '../../../src/entities/spawn.js';
import { createTestContext, createMonsterEntityFactory, spawnEntity } from '@quake2ts/test-utils';
import { monster_think } from '../../../src/ai/monster.js';
import { RenderFx } from '@quake2ts/shared';
import { Entity } from '../../../src/entities/entity.js';

describe('Monster AI - Soldier', () => {
  let system: EntitySystem;
  let registry: any;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    system = testContext.entities;

    vi.spyOn(testContext.engine, 'modelIndex').mockReturnValue(1);
    registry = createDefaultSpawnRegistry(testContext.engine);

    // targetAwareness mocks are now provided by createTestContext in test-utils
  });

  it('spawns a soldier with default state', () => {
    const soldier = system.spawn();
    soldier.classname = 'monster_soldier';
    const spawnFunc = registry.get('monster_soldier');
    expect(spawnFunc).toBeDefined();

    spawnFunc(soldier, testContext);

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

    spawnFunc(soldier, testContext);

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
    spawnFunc(soldier, testContext);

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
    // targetAwareness mocks are now provided by createTestContext

    const monsterData = createMonsterEntityFactory('monster_soldier', {
      monsterinfo: {
        current_move: {
          firstframe: 0,
          lastframe: 10,
          frames: Array(11).fill({}),
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
        allow_spawn: null,
        freeze_time: 0
      } as any,
      frame: 0,
      renderfx: 0,
      inUse: true
    });

    entity = spawnEntity(context, monsterData);
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
