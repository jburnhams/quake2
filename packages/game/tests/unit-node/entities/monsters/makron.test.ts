import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SP_monster_makron } from '../../../../src/entities/monsters/makron.js';
import { Entity, MoveType, Solid, EntityFlags, DeadFlag } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';

describe('monster_makron', () => {
  let context: any;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    entity = context.entities.spawn();
    SP_monster_makron(entity, context);
  });

  it('initializes with correct properties', () => {
    expect(entity.classname).toBe('monster_makron');
    expect(entity.health).toBe(3000);
    expect(entity.movetype).toBe(MoveType.Step);
    expect(entity.solid).toBe(Solid.BoundingBox);
  });

  it('changes skin on pain', () => {
      entity.health = 1400;
      entity.pain!(entity, entity, 0, 10);
      expect(entity.skin).toBe(1);
  });

  it('handles death', () => {
    entity.die!(entity, entity, entity, 100, { x: 0, y: 0, z: 0 });
    expect(entity.deadflag).toBe(DeadFlag.Dead);
    expect(entity.monsterinfo.current_move!.firstframe).toBe(155);
  });
});
