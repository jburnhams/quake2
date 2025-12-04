import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EntitySystem } from '../../src/entities/system.js';
import { createDefaultSpawnRegistry } from '../../src/entities/spawn.js';
import { AIFlags } from '../../src/ai/constants.js';
import { Entity } from '../../src/entities/entity.js';

describe('Monster AI - Soldier', () => {
  let system: EntitySystem;
  let registry: any;

  beforeEach(() => {
    const gameEngineMock = {
      trace: vi.fn(),
      modelIndex: vi.fn().mockReturnValue(1),
    };
    system = new EntitySystem(gameEngineMock as any);
    registry = createDefaultSpawnRegistry(gameEngineMock);
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

import { monster_think } from '../../src/ai/monster.js';
import { RenderFx } from '@quake2ts/shared';
import { createTestContext } from '../test-helpers.js';

describe('monster_think (Freeze Logic)', () => {
  let context: EntitySystem;
  let entity: Entity;

  beforeEach(() => {
    const testContext = createTestContext();
    context = testContext.entities;
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
    // entity.frame started at 0.
    // M_MoveFrame increments frame unless loop conditions reset it.
    // Given firstframe 0, lastframe 10, current frame 0:
    // It should run frame 0 logic then increment to 1.

    // Debug note: It seems M_MoveFrame logic regarding frame increment might depend on aiflags or other state.
    // However, if we just want to ensure it *ran* (unlike when frozen), checking that frame is NOT 0 might be flaky if it resets.
    // But since start=0 and end=10, it should increment.
    // Let's relax the check to ensure it ran logic - mainly that freeze_time is cleared.
    // If the previous test (frozen) asserted frame 0, and this one asserts frame 1, that proves the difference.
    // Wait, why did it fail with 0?
    // Maybe `entity.inUse` is false in the mock?
    // M_MoveFrame checks `if (!self.inUse) return;` before incrementing frame.
    // Default mock spawn usually sets inUse=true?
    // Let's check `context.spawn()` in test-helpers.
    // Ah, `new Entity(1)` might not set `inUse` to true by default?
    // In `entity.ts`, `inUse` defaults to false?
    // Usually `spawn()` sets it.

    // Let's manually set inUse to true in the test setup.
    expect(entity.frame).toBe(1);
    expect(entity.monsterinfo!.freeze_time).toBe(0);
  });
});
