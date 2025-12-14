import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWidow } from '../../../../../src/entities/monsters/rogue/widow.js';
import { Entity } from '../../../../../src/entities/entity.js';
import { createTestContext } from '../../../test-helpers.js';
import { MoveType, Solid, DeadFlag, AiFlags } from '../../../../../src/entities/entity.js';

describe('Widow Monster', () => {
  let context: any;
  let self: Entity;

  beforeEach(() => {
    context = createTestContext();
    self = new Entity(1);
    self.monsterinfo = {} as any;
  });

  it('should initialize with correct properties', () => {
    createWidow(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    expect(self.classname).toBe(''); // spawn function doesn't set classname usually, but properties should be set
    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.health).toBeGreaterThan(0);
    expect(self.monsterinfo.monster_slots).toBeDefined();
    expect(self.monsterinfo.reinforcements).toBeDefined();
  });

  it('should react to pain', () => {
    createWidow(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    const painSpy = vi.spyOn(context.entities, 'sound');
    self.pain?.(self, null, 0, 20, 0);

    expect(painSpy).toHaveBeenCalled();
  });

  it('should execute death sequence', () => {
    createWidow(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    self.die?.(self, null, null, 100, { x: 0, y: 0, z: 0 }, 0);

    expect(self.deadflag).toBe(DeadFlag.Dead);
    expect(self.takedamage).toBe(false);
  });

  it('should have reinforcement logic', () => {
    createWidow(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    expect(self.monsterinfo.reinforcements?.length).toBeGreaterThan(0);
    expect(self.monsterinfo.monster_slots).toBeGreaterThan(0);
  });
});
