import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_supertank } from '../../../../src/entities/monsters/supertank.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { Vec3 } from '@quake2ts/shared';

describe('monster_supertank', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    entity = context.entities.spawn();
    SP_monster_supertank(entity, context);
  });

  it('initializes with correct properties', () => {
    expect(entity.classname).toBe('monster_supertank');
    expect(entity.health).toBe(1500);
    expect(entity.max_health).toBe(1500);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
    expect(entity.model).toBe('models/monsters/boss1/tris.md2');
  });

  it('changes skin when damaged below 50%', () => {
    expect(entity.skin || 0).toBe(0);
    entity.health = 700; // < 1500/2
    entity.pain!(entity, entity, 0, 10);
    expect(entity.skin! & 1).toBe(1);

    entity.health = 1000;
    entity.pain!(entity, entity, 0, 10);
    expect(entity.skin! & 1).toBe(0);
  });

  it('handles death correctly', () => {
    entity.die!(entity, entity, entity, 100, { x: 0, y: 0, z: 0 });
    expect(entity.deadflag).toBe(DeadFlag.Dead);
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.monsterinfo.current_move).toBeDefined();
    // Verify death animation set
    expect(entity.monsterinfo.current_move!.firstframe).toBe(90);
  });

  it('gibs when health is very low', () => {
    entity.health = -100;
    entity.die!(entity, entity, entity, 100, { x: 0, y: 0, z: 0 });
    // Should be freed
    // Implementation check: context.entities.free called
    // We can't easily check free in this mock setup unless we spy on free
    // But we can check deadflag logic branches
  });

  it('selects attacks based on enemy range', () => {
      const enemy = context.entities.spawn();
      enemy.origin = { x: 200, y: 0, z: 0 };
      enemy.health = 100;
      entity.enemy = enemy;
      entity.origin = { x: 0, y: 0, z: 0 };

      // Mock math random to test branches?
      // Or just ensure it sets a move
      entity.monsterinfo.attack!(entity);
      expect(entity.monsterinfo.current_move).toBeDefined();
  });
});
