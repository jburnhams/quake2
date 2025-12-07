import type { Entity, MonsterMove } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { AIFlags, AttackState } from './constants.js';
import { RenderFx, MASK_SHOT, MASK_SOLID, ZERO_VEC3, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';
import { rangeTo, RangeCategory, classifyRange, visible } from './perception.js';

// Reference: game/m_monster.c

// [Paril-KEX] split this out so we can use it for the other bosses
export function M_CheckAttack_Base(self: Entity, context: EntitySystem, stand_ground_chance: number, melee_chance: number, near_chance: number, mid_chance: number, far_chance: number, strafe_scalar: number): boolean {
    if (self.enemy && (self.enemy.flags & (1 << 24))) { // FL_NOVISIBLE
        return false;
    }

    if (!self.enemy) return false;

    let spot1 = { ...self.origin };
    spot1.z += self.viewheight;

    // see if any entities are in the way of the shot
    let tr: any;
    if (!self.enemy.client || self.enemy.solid !== 0) { // SOLID_NOT = 0
        let spot2 = { ...self.enemy.origin };
        spot2.z += (self.enemy.viewheight || 0);

        tr = context.trace(spot1, spot2, ZERO_VEC3, ZERO_VEC3, self, MASK_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_SLIME | CONTENTS_LAVA);
    } else {
        tr = { ent: null, fraction: 0 };
    }

    // do we have a clear shot?
    if (tr.ent !== self.enemy && (!tr.ent || !tr.ent.client)) { // Simplified SVF_PLAYER check
        // ROGUE - we want them to go ahead and shoot at info_notnulls if they can.
        if (self.enemy.solid !== 0 || tr.fraction < 1.0) {
             // PMM - if we can't see our target, and we're not blocked by a monster, go into blind fire if available
             // Paril - *and* we have at least seen them once (trail_time > 0)
             if ((!tr.ent || !(tr.ent.svflags & 4)) && !visible(self, self.enemy, context.trace, { throughGlass: false }) && self.monsterinfo.trail_time > 0) { // SVF_MONSTER = 4
                 if (self.monsterinfo.blindfire && (self.monsterinfo.blind_fire_delay || 0) <= 20.0) {
                     if (context.timeSeconds < self.attack_finished_time) {
                         return false;
                     }
                     if (context.timeSeconds < (self.monsterinfo.trail_time + (self.monsterinfo.blind_fire_delay || 0))) {
                         // wait for our time
                         return false;
                     } else {
                         // make sure we're not going to shoot a monster
                         if (!self.monsterinfo.blind_fire_target) return false;

                         tr = context.trace(spot1, self.monsterinfo.blind_fire_target, ZERO_VEC3, ZERO_VEC3, self, CONTENTS_MONSTER);
                         if (tr.allsolid || tr.startsolid || ((tr.fraction < 1.0) && (tr.ent !== self.enemy))) {
                             return false;
                         }

                         self.monsterinfo.attack_state = AttackState.Blind;
                         return true;
                     }
                 }
             }
             return false;
        }
    }

    const enemy_range = rangeTo(self, self.enemy);

    // melee attack
    if (enemy_range <= 20) { // RANGE_MELEE
        if (self.monsterinfo.melee && (self.monsterinfo.melee_debounce_time || 0) <= context.timeSeconds) {
            self.monsterinfo.attack_state = AttackState.Melee;
        } else {
            self.monsterinfo.attack_state = AttackState.Missile;
        }
        return true;
    }

    // if we were in melee just before this but we're too far away, get out of melee state now
    if (self.monsterinfo.attack_state === AttackState.Melee && (self.monsterinfo.melee_debounce_time || 0) > context.timeSeconds) {
        self.monsterinfo.attack_state = AttackState.Missile;
    }

    // missile attack
    if (!self.monsterinfo.attack) {
        self.monsterinfo.attack_state = AttackState.Straight;
        return false;
    }

    if (context.timeSeconds < self.attack_finished_time) {
        return false;
    }

    let chance = 0;
    if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        chance = stand_ground_chance;
    } else if (enemy_range <= 20) {
        chance = melee_chance;
    } else if (enemy_range <= 440) { // RANGE_NEAR
        chance = near_chance;
    } else if (enemy_range <= 940) { // RANGE_MID
        chance = mid_chance;
    } else {
        chance = far_chance;
    }

    // PGM - go ahead and shoot every time if it's a info_notnull
    if ((!self.enemy.client && self.enemy.solid === 0) || (context.rng.frandom() < chance)) {
        self.monsterinfo.attack_state = AttackState.Missile;
        self.attack_finished_time = context.timeSeconds;
        return true;
    }

    if ((self.monsterinfo.aiflags & AIFlags.Pathing) === 0) {
         self.monsterinfo.attack_state = AttackState.Straight;
    }

    return false;
}

export function M_CheckAttack(self: Entity, context: EntitySystem): boolean {
    return M_CheckAttack_Base(self, context, 0.7, 0.4, 0.25, 0.06, 0, 1.0);
}

export function M_MoveFrame(self: Entity, context: EntitySystem): void {
  const move = self.monsterinfo.current_move;
  if (!move) {
    return;
  }

  if (self.frame < move.firstframe || self.frame > move.lastframe) {
    self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
    self.frame = move.firstframe;
  }

  if ((self.monsterinfo.aiflags & AIFlags.HoldFrame) !== 0) {
    return;
  }

  const index = self.frame - move.firstframe;
  const frame = move.frames[index];

  if (frame.ai) {
    frame.ai(self, frame.dist, context);
  }

  if (frame.think) {
    frame.think(self, context);
  }

  if (!self.inUse) {
    return;
  }

  self.frame++;
  if (self.frame > move.lastframe) {
    if (move.endfunc) {
      move.endfunc(self, context);
      // If endfunc changed the move, return (so we don't increment frame of new move wrongly or something?)
      // The original code returns here.
      if (self.monsterinfo.current_move !== move) {
        return;
      }
    }
  }
}

export function monster_think(self: Entity, context: EntitySystem): void {
  // Check for freeze effect
  if (self.monsterinfo.freeze_time) {
    if (self.monsterinfo.freeze_time > context.timeSeconds) {
      // Apply ice shell effect
      self.renderfx |= RenderFx.ShellBlue | RenderFx.ShellGreen;

      // Stop animation/thinking while frozen.
      // Reschedule check for later to see if we thawed.
      self.nextthink = context.timeSeconds + 0.1;
      return;
    } else {
      // Freeze expired
      self.monsterinfo.freeze_time = 0;
      // Clear effect
      self.renderfx &= ~(RenderFx.ShellBlue | RenderFx.ShellGreen);
    }
  }

  M_MoveFrame(self, context);

  // If M_MoveFrame didn't kill us or change think
  if (self.nextthink <= context.timeSeconds) {
      self.nextthink = context.timeSeconds + 0.1;
  }
}
