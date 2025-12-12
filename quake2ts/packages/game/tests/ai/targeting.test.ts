import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai_checkattack } from '../../src/ai/targeting.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { AIFlags, AttackState } from '../../src/ai/constants.js';
import { createTestContext, createEntity } from '../test-helpers.js';

describe('ai_checkattack', () => {
  let context: EntitySystem;
  let self: Entity;
  let enemy: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    self = createEntity();
    self.classname = 'monster_test';
    self.origin = { x: 0, y: 0, z: 0 };
    self.monsterinfo = {
        checkattack: vi.fn(() => true), // Mock monster specific check
        attack_state: AttackState.Straight
    };

    enemy = createEntity();
    enemy.classname = 'player';
    enemy.origin = { x: 100, y: 0, z: 0 };
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
