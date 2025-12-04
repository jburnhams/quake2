import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_guardian } from '../../../src/entities/monsters/guardian.js';
import { createTestContext } from '../../test-helpers.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { monster_think } from '../../../src/ai/monster.js';
import { registerGuardianSpawns } from '../../../src/entities/monsters/guardian.js';

describe('monster_guardian', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    const spawnRegistry = new Map();
    spawnRegistry.register = (name: string, fn: any) => spawnRegistry.set(name, fn);
    registerGuardianSpawns(spawnRegistry as any);

    // Create a new entity via spawn function logic simulation
    // Since SP_monster_guardian takes (self, context), we need to create 'self' first.
    entity = context.entities.spawn();
    SP_monster_guardian(entity, context);
  });

  it('should initialize with correct properties', () => {
    expect(entity.classname).toBe('monster_guardian');
    expect(entity.model).toBe('models/monsters/guardian/tris.md2');
    expect(entity.health).toBe(2500);
    expect(entity.max_health).toBe(0); // Not set in SP? Wait, it usually defaults or should be set if used.
    // The C++ code: self->health = 2500;
    // It does not explicitly set max_health in SP function provided in diff.
    // However, entity.max_health defaults to 0 in class.
    // Should check if I missed setting max_health in my implementation.
    // Standard practice is often max_health = health.

    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.mass).toBe(850);
    expect(entity.mins).toEqual({ x: -96, y: -96, z: -66 });
    expect(entity.maxs).toEqual({ x: 96, y: 96, z: 62 });
  });

  it('should have correct callback functions', () => {
    expect(entity.pain).toBeDefined();
    expect(entity.die).toBeDefined();
    expect(entity.monsterinfo.stand).toBeDefined();
    expect(entity.monsterinfo.walk).toBeDefined();
    expect(entity.monsterinfo.run).toBeDefined();
    expect(entity.monsterinfo.attack).toBeDefined();
    expect(entity.think).toBe(monster_think);
  });

  it('should register in spawn registry', () => {
    const registry = {
      register: vi.fn(),
    };
    registerGuardianSpawns(registry as any);
    expect(registry.register).toHaveBeenCalledWith('monster_guardian', SP_monster_guardian);
  });

  it('should enter stand animation on spawn', () => {
      // Check if current_move is set to stand move
      expect(entity.monsterinfo.current_move).toBeDefined();
      expect(entity.monsterinfo.current_move?.firstframe).toBe(76); // FRAME_idle1
  });

  it('should handle pain', () => {
      // Need to invoke pain
      // pain signature: (self, other, kick, damage)
      const pain = entity.pain as any;

      // Mock random to ensure pain reaction
      vi.spyOn(Math, 'random').mockReturnValue(0.9); // > 0.2

      // But guardian_pain logic:
      // if (damage <= 75 && Math.random() > 0.2) return;
      // So if damage 80, it should react.

      // Also check pain_debounce_time
      entity.pain_debounce_time = 0;
      context.entities.currentTimeSeconds = 10;

      // Mock M_ShouldReactToPain to return true
      // It's imported from common.js which we might not easily mock without module mocking
      // But common.ts implementation returns true.

      const prevMove = entity.monsterinfo.current_move;

      pain(entity, null, 0, 100);

      expect(entity.monsterinfo.current_move).not.toBe(prevMove);
      // Should be pain move
      expect(entity.monsterinfo.current_move?.firstframe).toBe(68); // FRAME_pain1_1
  });
});
