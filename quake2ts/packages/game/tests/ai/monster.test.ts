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
        free: vi.fn()
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
        free: vi.fn()
    };
    spawnFunc(soldier, context);

    // Initial frame is usually set by the move start
    // In soldier.ts: self.monsterinfo.stand(self) sets current_move to stand_move.
    // stand_move.firstframe is 0.
    // But M_MoveFrame sets self.frame if out of bounds.
    // Initially self.frame is 0.

    // Run think
    const thinkContext = { timeSeconds: 1.0 }; // Mock context

    expect(soldier.frame).toBe(0);

    if (soldier.think) {
        soldier.think(soldier, thinkContext);
    }

    // M_MoveFrame increments frame
    expect(soldier.frame).toBe(1);
    expect(soldier.nextthink).toBeGreaterThan(soldier.timestamp);
  });

  it('loops animation', () => {
    const soldier = system.spawn();
    soldier.classname = 'monster_soldier';
    const spawnFunc = registry.get('monster_soldier');
    spawnFunc(soldier, { keyValues: {}, entities: system, warn: vi.fn(), free: vi.fn() });

    const move = soldier.monsterinfo.current_move!;
    expect(move).toBeDefined();

    // Set frame to last frame
    soldier.frame = move.lastframe;

    const thinkContext = { timeSeconds: 1.0 };
    if (soldier.think) {
        soldier.think(soldier, thinkContext);
    }

    // In Q2 logic, frame increments to lastframe + 1 (overshoot)
    expect(soldier.frame).toBe(move.lastframe + 1);

    // Run think again
    if (soldier.think) {
        soldier.think(soldier, thinkContext);
    }

    // Now it should have reset to firstframe, run AI for frame 0, and incremented to 1
    // So the loop is 29 -> 30 -> 1. Frame 0 is skipped in the loop.
    expect(soldier.frame).toBe(move.firstframe + 1);
  });
});
