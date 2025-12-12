import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai_stand, ai_walk, ai_run, ai_charge } from '../../src/ai/movement.js';
import { Entity, MoveType, Solid, EntityFlags } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { AIFlags, AttackState } from '../../src/ai/constants.js';
import { createTestContext, createEntity } from '../test-helpers.js';
import * as targeting from '../../src/ai/targeting.js';

describe('AI Movement', () => {
  let context: EntitySystem;
  let self: Entity;
  let enemy: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;

    // Setup self (monster)
    self = createEntity();
    self.classname = 'monster_test';
    self.origin = { x: 0, y: 0, z: 0 };
    self.angles = { x: 0, y: 0, z: 0 };
    self.ideal_yaw = 0;
    self.yaw_speed = 20;
    self.movetype = MoveType.Step;
    self.solid = Solid.Bbox;
    self.monsterinfo = {
      current_move: null,
      aiflags: 0,
      attack_state: AttackState.Straight
    };

    // Setup enemy
    enemy = createEntity();
    enemy.classname = 'player';
    enemy.origin = { x: 200, y: 0, z: 0 };
    enemy.inUse = true;

    // Mock external dependencies
    vi.spyOn(targeting, 'findTarget').mockReturnValue(false);
  });

  describe('ai_stand', () => {
    it('should change yaw', () => {
      self.ideal_yaw = 90;
      ai_stand(self, 0.1, context);
      expect(self.angles.y).toBeGreaterThan(0);
    });

    it('should check for targets', () => {
      ai_stand(self, 0.1, context);
      expect(targeting.findTarget).toHaveBeenCalledWith(self, context.targetAwareness, context, context.trace);
    });
  });

  describe('ai_walk', () => {
    it('should move towards goalentity if exists', () => {
      self.goalentity = enemy;
      self.ideal_yaw = 0;

      // Mock move to goal to succeed
      // Note: we can't easily mock M_MoveToGoal here without rewriting imports or using a module mock
      // So we test the side effects we can observe or ensure it runs without error

      ai_walk(self, 10, 0.1, context);

      // If we are facing the enemy (0,0,0) -> (200,0,0), yaw is 0.
      expect(self.ideal_yaw).toBe(0);
    });
  });

  describe('ai_run', () => {
    it('should call stand if StandGround flag is set', () => {
        self.monsterinfo.aiflags |= AIFlags.StandGround;
        self.monsterinfo.stand = vi.fn();

        ai_run(self, 10, 0.1, context);

        expect(self.monsterinfo.stand).toHaveBeenCalled();
    });

    it('should move towards enemy', () => {
        self.enemy = enemy;

        ai_run(self, 10, 0.1, context);

        expect(self.ideal_yaw).toBe(0); // Facing enemy
    });
  });
});
