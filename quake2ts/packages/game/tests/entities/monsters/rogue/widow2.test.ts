import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWidow2 } from '../../../../../src/entities/monsters/rogue/widow2.js';
import { Entity } from '../../../../../src/entities/entity.js';
import { createTestContext } from '../../../test-helpers.js';
import { MoveType, Solid, DeadFlag } from '../../../../../src/entities/entity.js';

describe('Widow2 Monster', () => {
  let context: any;
  let self: Entity;

  beforeEach(() => {
    context = createTestContext();
    self = new Entity(1);
    self.monsterinfo = {} as any;
  });

  it('should initialize widow2 properties', () => {
    createWidow2(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    expect(self.movetype).toBe(MoveType.Step);
    expect(self.solid).toBe(Solid.BoundingBox);
    expect(self.health).toBeGreaterThan(3000);
    expect(self.mass).toBe(2500);
  });

  it('should have attack methods defined', () => {
    createWidow2(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    expect(self.monsterinfo.attack).toBeDefined();
    expect(self.monsterinfo.checkattack).toBeDefined();
  });

  it('should handle pain logic', () => {
    createWidow2(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    const soundSpy = vi.spyOn(context.entities, 'sound');
    self.pain?.(self, null, 0, 80, 0);
    expect(soundSpy).toHaveBeenCalled();
  });

  it('should transition to death state', () => {
    createWidow2(self, {
      entities: context.entities,
      health_multiplier: 1.0,
      damage_multiplier: 1.0
    });

    self.die?.(self, null, null, 500, { x: 0, y: 0, z: 0 }, 0);
    expect(self.deadflag).toBe(DeadFlag.Dead);
  });
});
