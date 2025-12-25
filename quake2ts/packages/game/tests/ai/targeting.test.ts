import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai_checkattack } from '../../src/ai/targeting.js';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { AttackState } from '../../src/ai/constants.js';
import { createTestContext, createMonsterEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('ai_checkattack', () => {
  let context: EntitySystem;
  let self: Entity;
  let enemy: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    // Use factory to create monster
    const monsterData = createMonsterEntityFactory('monster_test', {
        origin: { x: 0, y: 0, z: 0 }
    });
    self = context.spawn();
    Object.assign(self, monsterData);

    // Override monsterinfo to provide checkattack mock which is required for this test.
    self.monsterinfo = {
        ...self.monsterinfo,
        checkattack: vi.fn(() => true),
        attack_state: AttackState.Straight
    } as any;

    // Use factory to create player enemy
    const playerData = createPlayerEntityFactory({
        origin: { x: 100, y: 0, z: 0 }
    });
    enemy = context.spawn();
    Object.assign(enemy, playerData);

    self.enemy = enemy;
  });

  it('should return false if no enemy', () => {
    self.enemy = null;
    expect(ai_checkattack(self, 0, context)).toBe(false);
  });

  it('should call monsterinfo.checkattack if present', () => {
    ai_checkattack(self, 0, context);
    expect(self.monsterinfo.checkattack).toHaveBeenCalled();
  });

  it('should return true if checkattack returns true', () => {
      expect(ai_checkattack(self, 0, context)).toBe(true);
  });

  it('should return false if checkattack returns false', () => {
      self.monsterinfo.checkattack = vi.fn(() => false);
      expect(ai_checkattack(self, 0, context)).toBe(false);
  });
});
