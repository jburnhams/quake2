import { Entity } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { M_ChangeYaw, facingIdeal, M_walkmove, monster_done_dodge } from './movement.js';
import { AIFlags, AttackState } from './constants.js';

// Constants
const MONSTER_TICK = 0.1;
const MAX_SIDESTEP = 8.0;

/**
 * Turn and close until within an angle to launch a melee attack
 * Based on g_ai.c ai_run_melee
 */
export function ai_run_melee(self: Entity, context: EntitySystem): void {
  // self.ideal_yaw = enemy_yaw; // Usually set by ai_checkattack or caller before this

  // ROGUE: check manual steering
  if (!(self.monsterinfo.aiflags & AIFlags.ManualSteering)) {
    M_ChangeYaw(self, MONSTER_TICK);
  }

  if (facingIdeal(self)) {
    self.monsterinfo.melee?.(self, context);
    self.monsterinfo.attack_state = AttackState.Straight;
  }
}

/**
 * Turn in place until within an angle to launch a missile attack
 * Based on g_ai.c ai_run_missile
 */
export function ai_run_missile(self: Entity, context: EntitySystem): void {
  // self.ideal_yaw = enemy_yaw; // See note in ai_run_melee

  // ROGUE: check manual steering
  if (!(self.monsterinfo.aiflags & AIFlags.ManualSteering)) {
    M_ChangeYaw(self, MONSTER_TICK);
  }

  if (facingIdeal(self)) {
    if (self.monsterinfo.attack) {
      self.monsterinfo.attack(self, context);
      self.monsterinfo.attack_finished = context.timeSeconds + 1.0 + context.rng.frandom() * 1.0; // 2.0 - 1.0 = 1.0 range
    }

    // ROGUE
    if (self.monsterinfo.attack_state === AttackState.Missile || self.monsterinfo.attack_state === AttackState.Blind) {
        self.monsterinfo.attack_state = AttackState.Straight;
    }
  }
}

/**
 * Strafe sideways, but stay at approximately the same range
 * Based on g_ai.c ai_run_slide (Rogue version has some changes)
 */
export function ai_run_slide_rogue(self: Entity, distance: number, context: EntitySystem): void {
    const ideal_yaw = self.ideal_yaw;
    const angle = 90;
    let ofs: number;

    if (self.monsterinfo.lefty) {
        ofs = angle;
    } else {
        ofs = -angle;
    }

    if (!(self.monsterinfo.aiflags & AIFlags.ManualSteering)) {
        M_ChangeYaw(self, MONSTER_TICK);
    }

    let dist = distance;

    if (M_walkmove(self, ideal_yaw + ofs, dist, context)) {
        return;
    }

    // PMM - if we're dodging, give up on it and go straight
    if (self.monsterinfo.aiflags & AIFlags.Dodging) {
        monster_done_dodge(self);
        self.monsterinfo.attack_state = AttackState.Straight;
        return;
    }

    self.monsterinfo.lefty = self.monsterinfo.lefty ? 0 : 1;
    if (M_walkmove(self, ideal_yaw - ofs, dist, context)) {
        return;
    }

    // PMM - if we're dodging, give up on it and go straight
    if (self.monsterinfo.aiflags & AIFlags.Dodging) {
        monster_done_dodge(self);
    }

    // PMM - the move failed, so signal the caller (ai_run) to try going straight
    self.monsterinfo.attack_state = AttackState.Straight;
}
