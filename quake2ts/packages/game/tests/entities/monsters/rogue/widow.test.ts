import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWidow } from '../../../../src/entities/monsters/rogue/widow.js';
import { createTestContext } from '../../../test-helpers.js';
import { Entity, MoveType, Solid } from '../../../../src/entities/entity.js';

describe('monster_widow', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    context.health_multiplier = 1.0;
    // Mock skill if needed, default is usually 1 (Medium) in game, but test helper?
    context.entities.skill = 1;
    entity = context.entities.spawn();
    vi.clearAllMocks();
  });

  it('should spawn with correct initial state', () => {
    createWidow(entity, context);

    // Health: 2000 + 1000 * 1 = 3000
    expect(entity.health).toBe(3000);
    expect(entity.mass).toBe(1500);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.mins).toEqual({ x: -40, y: -40, z: 0 });
    expect(entity.maxs).toEqual({ x: 40, y: 40, z: 144 });
  });

  it('should have pain and die callbacks', () => {
    createWidow(entity, context);
    expect(entity.pain).toBeDefined();
    expect(entity.die).toBeDefined();
  });

  it('should initialize monster info slots', () => {
      createWidow(entity, context);
      // Skill 1 => slots 3
      expect(entity.monsterinfo.monster_slots).toBe(3);
  });
});
