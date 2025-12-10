import { angleMod, degToRad, vectorToYaw, addVec3, scaleVec3, dotProduct, subtractVec3, lengthVec3, angleVectors, normalizeVec3 } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { MoveType, EntityFlags } from '../entities/entity.js';
import { MASK_MONSTERSOLID, MASK_WATER, MASK_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';
import { AIFlags } from './constants.js';
import { M_CheckAttack } from './monster.js';

type MutableVec3 = { x: number; y: number; z: number };

const STEPSIZE = 18;

function yawVector(yawDegrees: number, distance: number): Vec3 {
  if (distance === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const radians = degToRad(yawDegrees);
  return {
    x: Math.cos(radians) * distance,
    y: Math.sin(radians) * distance,
    z: 0,
  };
}

/**
 * Mirror of the rerelease `M_walkmove` helper without collision.
 * Moves the entity along its yaw plane and always reports success.
 */
export function walkMove(self: Entity, yawDegrees: number, distance: number): boolean {
  const delta = yawVector(yawDegrees, distance);
  const origin = self.origin as MutableVec3;
  origin.x += delta.x;
  origin.y += delta.y;
  origin.z += delta.z;
  return true;
}

/**
 * Match the rerelease `M_ChangeYaw` turning speed rules.
 * `yaw_speed` is interpreted the same way as Quake II: degrees per tenth-second.
 */
export function changeYaw(self: Entity, deltaSeconds: number): void {
  const current = angleMod(self.angles.y);
  const ideal = self.ideal_yaw;

  if (current === ideal) {
    (self.angles as MutableVec3).y = current;
    return;
  }

  // The rerelease scales yaw_speed by (10 / tick_rate); using deltaSeconds keeps that
  // behavior across arbitrary fixed-step rates.
  const speed = self.yaw_speed * deltaSeconds * 10;

  let move = ideal - current;
  if (ideal > current) {
    if (move >= 180) move -= 360;
  } else if (move <= -180) {
    move += 360;
  }

  if (move > speed) move = speed;
  else if (move < -speed) move = -speed;

  (self.angles as MutableVec3).y = angleMod(current + move);
}

export function facingIdeal(self: Entity): boolean {
  const delta = angleMod(self.angles.y - self.ideal_yaw);
  const hasPathing = (self.monsterinfo.aiflags & AIFlags.Pathing) !== 0;

  if (hasPathing) {
    return !(delta > 5 && delta < 355);
  }

  return !(delta > 45 && delta < 315);
}

export function ai_move(self: Entity, distance: number): void {
  walkMove(self, self.angles.y, distance);
}

function setIdealYawTowards(self: Entity, target: Entity | null): void {
  if (!target) return;

  const toTarget: Vec3 = {
    x: target.origin.x - self.origin.x,
    y: target.origin.y - self.origin.y,
    z: target.origin.z - self.origin.z,
  };
  self.ideal_yaw = vectorToYaw(toTarget);
}

import { rangeTo, visible } from './perception.js';
import { findTarget } from './targeting.js';

export function ai_stand(self: Entity, deltaSeconds: number, context: EntitySystem): void {
  if (findTarget(self, context.targetAwareness, context, context.trace)) {
     return;
  }

  if (self.enemy && self.enemy.inUse) {
      // If we have an enemy, we might need to update blind_fire_target if visible
      // See ai_stand in g_ai.cpp: it calls ai_checkattack which implicitly checks visibility.
      // But we also update blind_fire_target in ai_charge.

      // In ai_stand, we mainly check if we should wake up.
      // The logic in g_ai.cpp ai_stand is quite complex, checking for stand ground, looking for players, etc.
      // For now, minimal port.
  }

  changeYaw(self, deltaSeconds);
}

export function ai_walk(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
  // Check for enemy
  if (findTarget(self, context.targetAwareness, context, context.trace)) {
    return;
  }

  setIdealYawTowards(self, self.goalentity);
  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }

  // Check if we reached goal (path_corner logic)
  if (self.goalentity && self.goalentity.classname === 'path_corner') {
    const dist = rangeTo(self, self.goalentity);
    if (dist < 64) {
      if (self.goalentity.target) {
        const next = context.pickTarget(self.goalentity.target);
        if (next) {
          self.goalentity = next;
          self.ideal_yaw = self.angles.y;
        }
      }
    }
  }
}

export function ai_turn(self: Entity, distance: number, deltaSeconds: number): void {
  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }

  // ROGUE
  if ((self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    changeYaw(self, deltaSeconds);
  }
}

export function ai_run(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
  if ((self.monsterinfo.aiflags & AIFlags.StandGround) !== 0) {
    self.monsterinfo.stand?.(self, context);
    return;
  }

  if (findTarget(self, context.targetAwareness, context, context.trace)) {
      // In original code, ai_run calls FindTarget, if found and it's a new enemy (or we are not fighting), we might switch.
      // Actually FindTarget usually returns true if it found a valid target.
      // If we already have an enemy, FindTarget might check for better one or just return.
      // But typically we rely on self.enemy being set.

      // If we found a target and it's DIFFERENT or we didn't have one?
      // For now, assume findTarget handles the switching/activation.
  }

  if (self.enemy && self.enemy.inUse && visible(self, self.enemy, context.trace, { throughGlass: false })) {
      self.monsterinfo.blind_fire_target = addVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, -0.1));
  }

  // ROGUE
  if ((self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    setIdealYawTowards(self, self.enemy ?? self.goalentity);
  }
  changeYaw(self, deltaSeconds);

  const checkAttack = self.monsterinfo.checkattack || M_CheckAttack;
  if (checkAttack(self, context)) {
    return;
  }

  if (distance !== 0) {
    // Using M_walkmove logic equivalent
    M_walkmove(self, self.angles.y, distance, context);
  }
}

export function ai_face(
  self: Entity,
  enemy: Entity | null,
  distance: number,
  deltaSeconds: number,
): void {
  // ROGUE
  if (enemy && (self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    setIdealYawTowards(self, enemy);
  }

  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}

export function ai_charge(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
  // PMM - save blindfire target
  if (self.enemy && self.enemy.inUse && visible(self, self.enemy, context.trace, { throughGlass: false })) {
      self.monsterinfo.blind_fire_target = addVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, -0.1));
  }

  // ROGUE
  if ((self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    setIdealYawTowards(self, self.enemy);
  }
  changeYaw(self, deltaSeconds);

  const checkAttack = self.monsterinfo.checkattack || M_CheckAttack;
  if (checkAttack(self, context)) {
    return;
  }

  if (distance !== 0) {
    M_walkmove(self, self.angles.y, distance, context);
  }
}

export function CheckGround(self: Entity, context: EntitySystem): void {
  if (self.movetype === MoveType.Noclip) {
    return;
  }

  const point = {
    x: self.origin.x,
    y: self.origin.y,
    z: self.origin.z + self.mins.z - 1
  };

  const trace = context.trace(self.origin, self.mins, self.maxs, point, self, MASK_MONSTERSOLID);

  self.groundentity = trace.ent;

  if (!self.groundentity && !trace.allsolid && !trace.startsolid && trace.fraction === 1.0) {
      // check water
      const content = context.pointcontents(point);
      if (content & MASK_WATER) {
          self.waterlevel = 1; // Simplification, real check is more complex
          self.watertype = content;
      } else {
          self.waterlevel = 0;
          self.watertype = 0;
      }
  }
}

export function M_CheckBottom(self: Entity, context: EntitySystem): boolean {
  const mins = {
    x: self.origin.x + self.mins.x,
    y: self.origin.y + self.mins.y,
    z: self.origin.z + self.mins.z,
  };
  const maxs = {
    x: self.origin.x + self.maxs.x,
    y: self.origin.y + self.maxs.y,
    z: self.origin.z + self.maxs.z,
  };

  // Check 4 corners. For now, check 2 opposite corners as a simplification (like my earlier impl).
  // Or do the full check. Rerelease M_CheckBottom iterates corners.

  let start: MutableVec3 = { x: 0, y: 0, z: 0 };
  let stop: MutableVec3 = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < 2; i++) {
    // Corner 1: mins.x, mins.y
    if (i === 0) start = { x: mins.x, y: mins.y, z: 0 };
    else start = { x: maxs.x, y: maxs.y, z: 0 }; // Corner 4: maxs.x, maxs.y

    start.z = mins.z - 1;

    // Check point contents first (if solid, we are good)
    const contents = context.pointcontents(start);
    if ((contents & MASK_SOLID) !== 0) return true;

    stop = { ...start };
    stop.z = start.z - 60; // Look down 60 units

    const trace = context.trace(start, null, null, stop, self, MASK_MONSTERSOLID);

    if (trace.fraction < 1.0) return true; // Hit something
  }

  return false;
}

export function SV_CloseEnough(self: Entity, goal: Entity, dist: number): boolean {
  for (let i = 0; i < 3; i++) {
    const minProp = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
    const goalAbsMin = goal.absmin[minProp];
    const goalAbsMax = goal.absmax[minProp];
    const selfAbsMin = self.absmin[minProp];
    const selfAbsMax = self.absmax[minProp];

    if (goalAbsMin > selfAbsMax + dist) return false;
    if (goalAbsMax < selfAbsMin - dist) return false;
  }
  return true;
}

export function SV_movestep(ent: Entity, move: Vec3, relink: boolean, context: EntitySystem): boolean {
  // PGM - Check for Bad Area would go here

  // flying monsters don't step up
  if ((ent.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) {
      // SV_flystep stub
      return false; // For now
  }

  const oldorg = { ...ent.origin };
  let stepsize = STEPSIZE;

  // SPAWNFLAG_MONSTER_SUPER_STEP logic if supported
  // if (ent.spawnflags & SPAWNFLAG_MONSTER_SUPER_STEP) stepsize = 64;

  if ((ent.monsterinfo.aiflags & AIFlags.NoStep) !== 0) {
      stepsize = 1;
  }

  // Need gravity vector, assuming standard 0,0,-1
  // Rerelease code adds gravityVector * (-1 * stepsize) -> moves UP against gravity
  // So start_up = origin + {0,0,stepsize}

  // Using simplified logic for standard gravity:
  const start_up: MutableVec3 = {
      x: oldorg.x,
      y: oldorg.y,
      z: oldorg.z + stepsize + 0.75 // match rerelease float
  };

  const mask = MASK_MONSTERSOLID; // Using standard monster clip

  // Trace up
  let up_trace = context.trace(oldorg, ent.mins, ent.maxs, start_up, ent, mask);

  if (up_trace.startsolid) {
       start_up.z += stepsize; // Try higher? Rerelease does this if startsolid
       up_trace = context.trace(start_up, ent.mins, ent.maxs, start_up, ent, mask); // Trace in place?
  }

  const end_up = { x: start_up.x + move.x, y: start_up.y + move.y, z: start_up.z + move.z };
  up_trace = context.trace(start_up, ent.mins, ent.maxs, end_up, ent, mask);

  // Normal trace
  const start_fwd = oldorg;
  const end_fwd = { x: start_fwd.x + move.x, y: start_fwd.y + move.y, z: start_fwd.z + move.z };
  const fwd_trace = context.trace(start_fwd, ent.mins, ent.maxs, end_fwd, ent, mask);

  // Pick best
  const chosen_forward = (up_trace.fraction > fwd_trace.fraction) ? up_trace : fwd_trace;

  if (chosen_forward.startsolid || chosen_forward.allsolid) {
      return false;
  }

  let steps = 1;
  let stepped = false;

  if (up_trace.fraction > fwd_trace.fraction) {
      steps = 2; // Why 2? Rerelease uses logic related to gravity steps.
  }

  // Step down
  // end = chosen_forward.endpos + (gravityVector * (steps * stepsize))
  // Standard gravity is -z, so we subtract z
  const end = {
      x: chosen_forward.endpos.x,
      y: chosen_forward.endpos.y,
      z: chosen_forward.endpos.z - (steps * stepsize)
  };

  const down_trace = context.trace(chosen_forward.endpos, ent.mins, ent.maxs, end, ent, mask);

  if (Math.abs(ent.origin.z - down_trace.endpos.z) > 8) {
      stepped = true;
  }

  // Paril-KEX water handling
  if (ent.waterlevel <= 2) { // WATER_WAIST
      const end_point = down_trace.endpos;
      // Need categorization, simplistic check here
      const contents = context.pointcontents(end_point);
      if ((contents & (CONTENTS_SLIME | CONTENTS_LAVA)) !== 0) {
          return false;
      }
      // Check water depth if needed
  }

  if (down_trace.fraction === 1.0) {
       // Walked off edge?
       if ((ent.flags & EntityFlags.PartialGround) !== 0) {
           // allow
       } else {
           return false;
       }
  }

  // Commit move
  ent.origin = down_trace.endpos;

  // Check bottom
  if (!M_CheckBottom(ent, context)) {
      if ((ent.flags & EntityFlags.PartialGround) !== 0) {
          if (relink) {
             context.linkentity(ent);
          }
          return true;
      }
      ent.origin = oldorg;
      return false;
  }

  // Update ground
  CheckGround(ent, context);

  if (!ent.groundentity) {
      ent.origin = oldorg;
      CheckGround(ent, context); // Revert ground
      return false;
  }

  // Check if we moved enough
  if (lengthVec3(subtractVec3(ent.origin, oldorg)) < lengthVec3(move) * 0.05) {
      ent.origin = oldorg;
      CheckGround(ent, context);
      return false;
  }

  if (relink) {
      context.linkentity(ent);
  }

  return true;
}

export function M_walkmove(self: Entity, yawDegrees: number, distance: number, context: EntitySystem): boolean {
  if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) && self.movetype !== MoveType.Noclip) {
      if (!self.groundentity && self.waterlevel === 0) {
          return false;
      }
  }

  const delta = yawVector(yawDegrees, distance);

  if (SV_movestep(self, delta, true, context)) {
      self.monsterinfo.aiflags &= ~AIFlags.Blocked;
      return true;
  }

  return false;
}

export function SV_StepDirection(self: Entity, yaw: number, dist: number, context: EntitySystem): boolean {
  // Try intended direction first
  if (M_walkmove(self, yaw, dist, context)) {
      self.ideal_yaw = angleMod(yaw);
      return true;
  }

  // Try +/- 45 and 90 degrees
  for (let i = 45; i <= 90; i += 45) {
    if (M_walkmove(self, yaw + i, dist, context)) {
      self.ideal_yaw = angleMod(yaw + i);
      return true;
    }
    if (M_walkmove(self, yaw - i, dist, context)) {
      self.ideal_yaw = angleMod(yaw - i);
      return true;
    }
  }

  return false;
}

export function SV_NewChaseDir(self: Entity, enemy: Entity | null, dist: number, context: EntitySystem): void {
  if (!enemy) return;

  const olddir = angleMod((self.ideal_yaw - self.angles.y));
  const turnaround = Math.abs(olddir - 180) < 20;

  const dx = enemy.origin.x - self.origin.x;
  const dy = enemy.origin.y - self.origin.y;

  if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) self.ideal_yaw = 0;
      else self.ideal_yaw = 180;
  } else {
      if (dy > 0) self.ideal_yaw = 90;
      else self.ideal_yaw = 270;
  }

  if (turnaround) {
      self.ideal_yaw = angleMod(self.ideal_yaw + 180);
  }

  SV_StepDirection(self, self.ideal_yaw, dist, context);
}

// Stub for M_MoveToPath since we don't have GetPathToGoal
function M_MoveToPath(self: Entity, dist: number, context: EntitySystem): boolean {
    return false;
}

export function M_MoveToGoal(ent: Entity, dist: number, context: EntitySystem): void {
    const goal = ent.goalentity;

    if (!ent.groundentity && !((ent.flags & (EntityFlags.Fly | EntityFlags.Swim)) !== 0)) {
        return;
    }

    if (!goal) return;

    // Try pathing if enabled (stubbed)
    if (M_MoveToPath(ent, dist, context)) {
        return;
    }

    // Straight shot check
    if (!(ent.monsterinfo.aiflags & AIFlags.Charging) && goal) {
        if (!facingIdeal(ent)) {
            changeYaw(ent, MONSTER_TICK); // Assuming 0.1s tick
            return;
        }

        // Trace line
        const tr = context.trace(ent.origin, null, null, goal.origin, ent, MASK_MONSTERSOLID);
        if (tr.fraction === 1.0 || tr.ent === goal) {
             const yaw = vectorToYaw(subtractVec3(goal.origin, ent.origin));
             if (SV_StepDirection(ent, yaw, dist, context)) {
                 return;
             }
        }
    }

    // Bump around
    // Simplified bump logic
    if (Math.random() < 0.2 || !SV_StepDirection(ent, ent.ideal_yaw, dist, context)) {
        SV_NewChaseDir(ent, goal, dist, context);
    }
}

const MONSTER_TICK = 0.1;
