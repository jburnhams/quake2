import { angleMod, degToRad, vectorToYaw, addVec3, scaleVec3 } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { MoveType, EntityFlags } from '../entities/entity.js';
import { MASK_MONSTERSOLID, MASK_WATER } from '@quake2ts/shared';
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

  let start: MutableVec3 = { x: 0, y: 0, z: 0 };
  let stop: MutableVec3 = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < 2; i++) {
    if (i === 1) start = { x: mins.x, y: mins.y, z: 0 };
    else start = { x: maxs.x, y: mins.y, z: 0 };

    start.z = mins.z - 1;

    if (context.pointcontents(start) !== 0) return true;

    stop = { ...start };
    stop.z = start.z - 60;

    const trace = context.trace(start, null, null, stop, self, MASK_MONSTERSOLID);

    if (trace.fraction < 1.0) return true;

    if (i === 1) start = { x: mins.x, y: maxs.y, z: 0 };
    else start = { x: maxs.x, y: maxs.y, z: 0 };

    start.z = mins.z - 1;

    if (context.pointcontents(start) !== 0) return true;

    stop = { ...start };
    stop.z = start.z - 60;

    const trace2 = context.trace(start, null, null, stop, self, MASK_MONSTERSOLID);

    if (trace2.fraction < 1.0) return true;
  }

  return false;
}

export function M_walkmove(self: Entity, yawDegrees: number, distance: number, context: EntitySystem): boolean {
  // If we're not step/toss/bounce/fly, we can't move normally
  // but M_walkmove is usually called for monsters.
  // Original Quake 2: M_walkmove checks waterlevel or groundentity.

  if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) && self.movetype !== MoveType.Noclip) {
      if (!self.groundentity && self.waterlevel === 0) {
          return false;
      }
  }

  const delta = yawVector(yawDegrees, distance);

  if ((self.monsterinfo.aiflags & AIFlags.NoStep) !== 0 &&
      (self.monsterinfo.aiflags & AIFlags.Pathing) !== 0) {
      // In pathing mode with nostep, we just verify we can go there?
      // Actually original code SV_StepDirection handles logic.
  }

  const dest = {
      x: self.origin.x + delta.x,
      y: self.origin.y + delta.y,
      z: self.origin.z + delta.z
  };

  // 1. Try moving directly to destination
  const trace = context.trace(self.origin, self.mins, self.maxs, dest, self, MASK_MONSTERSOLID);

  if (trace.fraction === 1.0) {
      // Success? Check bottom if needed
      const oldOrigin = { ...self.origin };
      (self.origin as MutableVec3).x = dest.x;
      (self.origin as MutableVec3).y = dest.y;
      (self.origin as MutableVec3).z = dest.z;

      if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) && self.movetype !== MoveType.Noclip) {
         if (!M_CheckBottom(self, context)) {
             // Revert
             (self.origin as MutableVec3).x = oldOrigin.x;
             (self.origin as MutableVec3).y = oldOrigin.y;
             (self.origin as MutableVec3).z = oldOrigin.z;
             return false;
         }
      }

      // Update ground status
      if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0)) {
        CheckGround(self, context);
      }
      return true;
  }

  // 2. If blocked, and not flying/swimming, try stepping up
  // SV_movestep logic:
  // if (trace.fraction < 1) ...
  //   move up STEPSIZE
  //   trace
  //   move down STEPSIZE + extra

  if ((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) {
      return false; // Flying/Swimming monsters do not use step logic.
      // Original sv_movestep handles flying by just returning false if blocked (flymove handled elsewhere?)
      // Actually M_walkmove calls SV_movestep.
      // If flying, SV_movestep might try to slide?
      // But standard Q2 monsters (Flyer/Icarus) use MoveType.Step + EntityFlags.Fly.
      // So they enter this block.
      // If they hit a wall, they stop. They don't step up walls.
  }

  // Allow stepping up
  const oldOrigin = { ...self.origin };
  const up = { ...self.origin, z: self.origin.z + STEPSIZE };

  // Test move up
  const traceUp = context.trace(self.origin, self.mins, self.maxs, up, self, MASK_MONSTERSOLID);
  if (traceUp.startsolid || traceUp.allsolid) {
      return false; // Can't move up
  }

  // Move forward at the higher position
  const destUp = {
      x: up.x + delta.x,
      y: up.y + delta.y,
      z: up.z // stay at up z
  };

  const traceStep = context.trace(up, self.mins, self.maxs, destUp, self, MASK_MONSTERSOLID);
  if (traceStep.fraction < 1.0) {
      return false; // Still blocked
  }

  // Move down
  const destDown = {
      x: destUp.x,
      y: destUp.y,
      z: destUp.z - STEPSIZE // Go back down
  };

  // Trace down to find ground
  // We need to trace down further than just STEPSIZE to find the floor if it's a small step down
  // Original uses SV_CheckBottom or similar logic which traces down.
  // Actually SV_movestep:
  //   moves down by STEPSIZE.
  //   calls SV_CheckBottom(self).

  // In our case, M_CheckBottom checks for ledges, but doesn't snap to ground.
  // We need to find the ground.

  const downTraceDest = {
      x: destDown.x,
      y: destDown.y,
      z: destDown.z - STEPSIZE // Look a bit deeper?
  };

  // Actually we just want to land on the step.
  // So we trace down from `destUp` to `destDown`.

  const traceDown = context.trace(destUp, self.mins, self.maxs, destDown, self, MASK_MONSTERSOLID);

  if (traceDown.startsolid || traceDown.allsolid) {
       // Should not happen if we came from there?
       // Unless we stepped onto something that is now inside us?
       return false;
  }

  // Use the endpos of the down trace as the new position
  const newPos = traceDown.endpos;

  // Set position
  (self.origin as MutableVec3).x = newPos.x;
  (self.origin as MutableVec3).y = newPos.y;
  (self.origin as MutableVec3).z = newPos.z;

  // Check bottom (ledge check)
  if (!M_CheckBottom(self, context)) {
      // Revert
      (self.origin as MutableVec3).x = oldOrigin.x;
      (self.origin as MutableVec3).y = oldOrigin.y;
      (self.origin as MutableVec3).z = oldOrigin.z;
      return false;
  }

  // Update ground status
  CheckGround(self, context);

  // If we are not on ground after stepping, we might have stepped into air?
  // But M_CheckBottom should catch that.

  return true;
}

export function SV_StepDirection(self: Entity, yaw: number, dist: number, context: EntitySystem): boolean {
  for (let i = 0; i <= 90; i += 45) {
    if (M_walkmove(self, yaw + i, dist, context)) {
      if (i !== 0) {
        self.ideal_yaw = angleMod(yaw + i);
      }
      return true;
    }
    if (i !== 0) {
      if (M_walkmove(self, yaw - i, dist, context)) {
        self.ideal_yaw = angleMod(yaw - i);
        return true;
      }
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
