import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_boss2 } from '../../../../src/entities/monsters/boss2.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';

describe('monster_boss2', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    entity = context.entities.spawn();
    SP_monster_boss2(entity, context);
  });

  it('initializes with correct properties', () => {
    expect(entity.classname).toBe('monster_boss2');
    expect(entity.health).toBe(2000);
    expect(entity.flags & EntityFlags.Fly).toBe(EntityFlags.Fly);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
  });

  it('changes skin when damaged below 50%', () => {
    entity.health = 900;
    entity.pain!(entity, entity, 0, 10);
    expect(entity.skin).toBe(1);

    entity.health = 1500;
    entity.pain!(entity, entity, 0, 10);
    expect(entity.skin).toBe(0);
  });

  it('handles death', () => {
    entity.die!(entity, entity, entity, 100, { x: 0, y: 0, z: 0 });
    expect(entity.deadflag).toBe(DeadFlag.Dead);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.monsterinfo.current_move!.firstframe).toBe(112);
  });

  it('chooses attack based on range', () => {
    const enemy = context.entities.spawn();
    enemy.health = 100;
    entity.enemy = enemy;

    // Close range
    entity.origin = { x: 0, y: 0, z: 0 };
    enemy.origin = { x: 100, y: 0, z: 0 };
    entity.monsterinfo.attack!(entity);
    // Should choose Pre-MG move (frame 50-58)
    expect(entity.monsterinfo.current_move!.firstframe).toBe(50);
  });
});
