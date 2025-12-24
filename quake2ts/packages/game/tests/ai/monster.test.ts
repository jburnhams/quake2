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
    const { entities, engine } = createTestContext();
    system = entities;

    // Ensure modelIndex returns 1 as expected by the test
    vi.spyOn(engine, 'modelIndex').mockReturnValue(1);

    registry = createDefaultSpawnRegistry(engine);

    // Patch targetAwareness with necessary mocks
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
    // Should start in stand frames (0-29)
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

    // Initial frame is usually set by the move start
    // In soldier.ts: self.monsterinfo.stand(self) sets current_move to stand_move.
    // stand_move.firstframe is 0.
    // But M_MoveFrame sets self.frame if out of bounds.
    // Initially self.frame is 0.

    // Run think
    // Mock context needs targetAwareness now
    system.beginFrame(1.0);

    expect(soldier.frame).toBe(0);

    if (soldier.think) {
        soldier.think(soldier, system);
    }

    // M_MoveFrame increments frame
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

    // In Q2 logic, frame increments to lastframe + 1 (overshoot)
    expect(soldier.frame).toBe(move.lastframe + 1);

    // Run think again
    if (soldier.think) {
        soldier.think(soldier, system);
    }

    // Now it should have reset to firstframe, run AI for frame 0, and incremented to 1
    // So the loop is 29 -> 30 -> 1. Frame 0 is skipped in the loop.
    expect(soldier.frame).toBe(move.firstframe + 1);
  });
});

describe('monster_think (Freeze Logic)', () => {
  let context: EntitySystem;
  let entity: Entity;

  beforeEach(() => {
    const testContext = createTestContext();
    context = testContext.entities;
    // Patch targetAwareness for freeze logic tests as well if needed
    if (context.targetAwareness) {
        (context.targetAwareness as any).activePlayers = [];
        (context.targetAwareness as any).monsterAlertedByPlayers = vi.fn().mockReturnValue(null);
        (context.targetAwareness as any).soundClient = vi.fn().mockReturnValue(null);
    }

    entity = context.spawn();
    entity.inUse = true; // Ensure entity is marked active for M_MoveFrame
    entity.monsterinfo = {
      current_move: {
        firstframe: 0,
        lastframe: 10,
        frames: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}], // Dummy frames to avoid index error
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
    entity.monsterinfo!.freeze_time = 15; // Frozen for 5 seconds

    monster_think(entity, context);

    // Should have renderfx
    expect((entity.renderfx & RenderFx.ShellBlue)).toBeTruthy();
    expect((entity.renderfx & RenderFx.ShellGreen)).toBeTruthy();

    // Should NOT have advanced frame (because monster_think returns early)
    expect(entity.frame).toBe(0);

    // Should reschedule think
    expect(entity.nextthink).toBeGreaterThan(context.timeSeconds);
  });

  it('should clear freeze effect when timer expires', () => {
    context.timeSeconds = 20;
    entity.monsterinfo!.freeze_time = 15; // Expired
    entity.renderfx = RenderFx.ShellBlue | RenderFx.ShellGreen; // Pre-set

    monster_think(entity, context);

    // Should clear renderfx
    expect((entity.renderfx & RenderFx.ShellBlue)).toBeFalsy();
    expect((entity.renderfx & RenderFx.ShellGreen)).toBeFalsy();

    // Should have advanced frame (because M_MoveFrame was called)
    expect(entity.frame).toBe(1);
    expect(entity.monsterinfo!.freeze_time).toBe(0);
  });
});
