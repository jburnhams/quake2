import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ai_run_melee, ai_run_missile, ai_run_slide_rogue } from '../../../src/ai/movement_rogue.js';
import { Entity } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';
import { AttackState, AIFlags } from '../../../src/ai/constants.js';
import * as Movement from '../../../src/ai/movement.js';

describe('Rogue AI Movement', () => {
  let context: any;
  let self: Entity;

  beforeEach(() => {
    context = createTestContext();
    self = new Entity(1);
    self.monsterinfo = {
      aiflags: 0,
      attack_state: 0,
      lefty: 0,
      last_sighting: { x: 0, y: 0, z: 0 },
      trail_time: 0,
      pausetime: 0
    } as any;
    self.ideal_yaw = 0;
    self.angles = { x: 0, y: 0, z: 0 };
    self.origin = { x: 0, y: 0, z: 0 };
  });

  describe('ai_run_melee', () => {
    it('should turn towards ideal yaw if manual steering is off', () => {
      const changeYawSpy = vi.spyOn(Movement, 'M_ChangeYaw');
      self.monsterinfo.aiflags = 0;
      ai_run_melee(self, context.entities);
      expect(changeYawSpy).toHaveBeenCalledWith(self, 0.1);
    });

    it('should not turn if manual steering is on', () => {
      const changeYawSpy = vi.spyOn(Movement, 'M_ChangeYaw');
      self.monsterinfo.aiflags = AIFlags.ManualSteering;
      ai_run_melee(self, context.entities);
      expect(changeYawSpy).not.toHaveBeenCalled();
    });

    it('should attack if facing ideal yaw', () => {
      vi.spyOn(Movement, 'facingIdeal').mockReturnValue(true);
      const meleeSpy = vi.fn();
      self.monsterinfo.melee = meleeSpy;

      ai_run_melee(self, context.entities);

      expect(meleeSpy).toHaveBeenCalledWith(self, context.entities);
      expect(self.monsterinfo.attack_state).toBe(AttackState.Straight);
    });
  });

  describe('ai_run_missile', () => {
    it('should execute missile attack sequence when facing target', () => {
      vi.spyOn(Movement, 'facingIdeal').mockReturnValue(true);
      const attackSpy = vi.fn();
      self.monsterinfo.attack = attackSpy;
      self.monsterinfo.attack_state = AttackState.Missile;

      ai_run_missile(self, context.entities);

      expect(attackSpy).toHaveBeenCalledWith(self, context.entities);
      expect(self.monsterinfo.attack_state).toBe(AttackState.Straight);
      expect(self.monsterinfo.attack_finished).toBeGreaterThan(context.entities.timeSeconds);
    });
  });

  describe('ai_run_slide_rogue', () => {
    it('should slide left/right and update yaw', () => {
      const walkMoveSpy = vi.spyOn(Movement, 'M_walkmove').mockReturnValue(true);
      const changeYawSpy = vi.spyOn(Movement, 'M_ChangeYaw');

      self.monsterinfo.lefty = 1;
      ai_run_slide_rogue(self, 10, context.entities);

      expect(changeYawSpy).toHaveBeenCalled();
      expect(walkMoveSpy).toHaveBeenCalledWith(self, 90, 10, context.entities);
    });

    it('should retry other direction if first move fails', () => {
      const walkMoveSpy = vi.spyOn(Movement, 'M_walkmove')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);

      self.monsterinfo.lefty = 1;
      ai_run_slide_rogue(self, 10, context.entities);

      expect(walkMoveSpy).toHaveBeenCalledTimes(2);
      expect(self.monsterinfo.lefty).toBe(0);
    });

    it('should stop dodging if both moves fail', () => {
      vi.spyOn(Movement, 'M_walkmove').mockReturnValue(false);
      self.monsterinfo.aiflags = AIFlags.Dodging;

      ai_run_slide_rogue(self, 10, context.entities);

      expect(self.monsterinfo.aiflags & AIFlags.Dodging).toBe(0);
      expect(self.monsterinfo.attack_state).toBe(AttackState.Straight);
    });
  });
});
