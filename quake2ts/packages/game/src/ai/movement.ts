import { angleMod, degToRad, vectorToYaw, addVec3, scaleVec3, lengthVec3 } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { MoveType, EntityFlags } from '../entities/entity.js';
import { MASK_MONSTERSOLID, MASK_WATER, CONTENTS_SOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';
import { AIFlags, BOTTOM_EMPTY, BOTTOM_SOLID, BOTTOM_WATER, BOTTOM_SLIME, BOTTOM_LAVA } from './constants.js';
import { M_CheckAttack } from './monster.js';
import { rangeTo, visible } from './perception.js';
import { findTarget } from './targeting.js';

export type MutableVec3 = { x: number; y: number; z: number };

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

// Alias for strict adherence
export const M_ChangeYaw = changeYaw;

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

export function ai_stand(self: Entity, deltaSeconds: number, context: EntitySystem): void {
  if (findTarget(self, context.targetAwareness, context, context.trace)) {
     return;
  }

  // Minimal port logic
  changeYaw(self, deltaSeconds);
}

export function ai_walk(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
  // Check for enemy
  if (findTarget(self, context.targetAwareness, context, context.trace)) {
    return;
  }

  setIdealYawTowards(self, self.goalentity);
  changeYaw(self, deltaSeconds);

  // Replaced inline logic with M_MoveToGoal
  if (self.goalentity) {
    M_MoveToGoal(self, distance, context);
  } else {
    // Fallback if no goal (shouldn't happen in pathing, but maybe wandering?)
    if (distance !== 0) {
       M_walkmove(self, self.angles.y, distance, context);
    }
  }
}

export function ai_turn(self: Entity, distance: number, deltaSeconds: number): void {
  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }

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
      // Logic for switching targets if new one is found
  }

  if (self.enemy && self.enemy.inUse && visible(self, self.enemy, context.trace, { throughGlass: false })) {
      self.monsterinfo.blind_fire_target = addVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, -0.1));
  }

  if ((self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    setIdealYawTowards(self, self.enemy ?? self.goalentity);
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

export function ai_face(
  self: Entity,
  enemy: Entity | null,
  distance: number,
  deltaSeconds: number,
): void {
  if (enemy && (self.monsterinfo.aiflags & AIFlags.ManualSteering) === 0) {
    setIdealYawTowards(self, enemy);
  }

  changeYaw(self, deltaSeconds);

  if (distance !== 0) {
    walkMove(self, self.angles.y, distance);
  }
}

export function ai_charge(self: Entity, distance: number, deltaSeconds: number, context: EntitySystem): void {
  if (self.enemy && self.enemy.inUse && visible(self, self.enemy, context.trace, { throughGlass: false })) {
      self.monsterinfo.blind_fire_target = addVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, -0.1));
  }

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
      const content = context.pointcontents(point);
      if (content & MASK_WATER) {
          self.waterlevel = 1;
          self.watertype = content;
      } else {
          self.waterlevel = 0;
          self.watertype = 0;
      }
  }
}

export function M_CheckBottomEx(self: Entity, context: EntitySystem): number {
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

  // Fast check: if all corners are in solid, we are good
  let allSolid = true;
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      start.x = x ? maxs.x : mins.x;
      start.y = y ? maxs.y : mins.y;
      start.z = mins.z - 1;

      const content = context.pointcontents(start);
      if (content !== CONTENTS_SOLID) {
        allSolid = false;
        break;
      }
    }
    if (!allSolid) break;
  }

  if (allSolid) return BOTTOM_SOLID;

  // Slow check
  start.x = self.origin.x;
  start.y = self.origin.y;
  start.z = self.origin.z + self.mins.z;

  const stop = { ...start };
  stop.z = start.z - STEPSIZE * 2;

  const trace = context.trace(start, null, null, stop, self, MASK_MONSTERSOLID);

  if (trace.fraction === 1.0) return BOTTOM_EMPTY;

  const mid = trace.endpos.z;
  const bottomType = context.pointcontents(trace.endpos);
  let result = BOTTOM_SOLID;

  if (bottomType & CONTENTS_WATER) result = BOTTOM_WATER;
  else if (bottomType & CONTENTS_SLIME) result = BOTTOM_SLIME;
  else if (bottomType & CONTENTS_LAVA) result = BOTTOM_LAVA;

  // Check quadrants
  const stepQuadrantSize = {
      x: (self.maxs.x - self.mins.x) * 0.5,
      y: (self.maxs.y - self.mins.y) * 0.5,
  };

  const halfStepQuadrant = {
      x: stepQuadrantSize.x * 0.5,
      y: stepQuadrantSize.y * 0.5,
      z: 0
  };

  const halfStepQuadrantMins = {
      x: -halfStepQuadrant.x,
      y: -halfStepQuadrant.y,
      z: 0
  };

  const centerStart = {
      x: self.origin.x + (self.mins.x + self.maxs.x) * 0.5,
      y: self.origin.y + (self.mins.y + self.maxs.y) * 0.5,
      z: 0
  };

  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
        const quadrantStart = { ...centerStart };
        if (x) quadrantStart.x += halfStepQuadrant.x;
        else quadrantStart.x -= halfStepQuadrant.x;

        if (y) quadrantStart.y += halfStepQuadrant.y;
        else quadrantStart.y -= halfStepQuadrant.y;

        quadrantStart.z = start.z;
        const quadrantEnd = { ...quadrantStart, z: stop.z };

        const subTrace = context.trace(quadrantStart, halfStepQuadrantMins, halfStepQuadrant, quadrantEnd, self, MASK_MONSTERSOLID);

        if (subTrace.fraction === 1.0 || mid - subTrace.endpos.z > STEPSIZE) {
            return BOTTOM_EMPTY;
        }
    }
  }

  return result;
}

export function M_CheckBottom(self: Entity, context: EntitySystem): boolean {
  return M_CheckBottomEx(self, context) !== BOTTOM_EMPTY;
}

export function M_MoveStep(self: Entity, move: Vec3, relink: boolean, context: EntitySystem): boolean {
    if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) && self.movetype !== MoveType.Noclip) {
      if (!self.groundentity && self.waterlevel === 0) {
          return false;
      }
    }

    const dest = {
        x: self.origin.x + move.x,
        y: self.origin.y + move.y,
        z: self.origin.z + move.z
    };

    const trace = context.trace(self.origin, self.mins, self.maxs, dest, self, MASK_MONSTERSOLID);

    if (trace.fraction === 1.0) {
        const oldOrigin = { ...self.origin };
        (self.origin as MutableVec3).x = dest.x;
        (self.origin as MutableVec3).y = dest.y;
        (self.origin as MutableVec3).z = dest.z;

        if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) && self.movetype !== MoveType.Noclip) {
           if (!M_CheckBottom(self, context)) {
               (self.origin as MutableVec3).x = oldOrigin.x;
               (self.origin as MutableVec3).y = oldOrigin.y;
               (self.origin as MutableVec3).z = oldOrigin.z;
               return false;
           }
        }

        if (!((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0)) {
          CheckGround(self, context);
        }
        return true;
    }

    if ((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0) {
        return SV_flystep(self, move, relink, context);
    }

    const oldOrigin = { ...self.origin };
    const up = { ...self.origin, z: self.origin.z + STEPSIZE };

    const traceUp = context.trace(self.origin, self.mins, self.maxs, up, self, MASK_MONSTERSOLID);
    if (traceUp.startsolid || traceUp.allsolid) {
        return false;
    }

    const stepOrigin = traceUp.endpos;

    const destUp = {
        x: stepOrigin.x + move.x,
        y: stepOrigin.y + move.y,
        z: stepOrigin.z
    };

    const traceStep = context.trace(stepOrigin, self.mins, self.maxs, destUp, self, MASK_MONSTERSOLID);
    if (traceStep.fraction < 1.0) {
        return false;
    }

    const destDown = {
        x: destUp.x,
        y: destUp.y,
        z: destUp.z - STEPSIZE
    };

    const traceDown = context.trace(destUp, self.mins, self.maxs, destDown, self, MASK_MONSTERSOLID);
    if (traceDown.startsolid || traceDown.allsolid) {
         return false;
    }

    const newPos = traceDown.endpos;
    (self.origin as MutableVec3).x = newPos.x;
    (self.origin as MutableVec3).y = newPos.y;
    (self.origin as MutableVec3).z = newPos.z;

    if (!M_CheckBottom(self, context)) {
        (self.origin as MutableVec3).x = oldOrigin.x;
        (self.origin as MutableVec3).y = oldOrigin.y;
        (self.origin as MutableVec3).z = oldOrigin.z;
        return false;
    }

    CheckGround(self, context);
    return true;
}

export function M_walkmove(self: Entity, yawDegrees: number, distance: number, context: EntitySystem): boolean {
  const delta = yawVector(yawDegrees, distance);
  // Matches rerelease M_walkmove implementation
  // SV_movestep call via M_MoveStep
  const retval = M_MoveStep(self, delta, true, context);
  // Clears AI_BLOCKED flag
  self.monsterinfo.aiflags &= ~AIFlags.Blocked;
  return retval;
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

function SV_CloseEnough(self: Entity, goal: Entity, dist: number): boolean {
    if (!goal) return false;

    // Using box distance check similar to Quake 2
    const dx = Math.abs(self.origin.x - goal.origin.x);
    const dy = Math.abs(self.origin.y - goal.origin.y);
    const dz = Math.abs(self.origin.z - goal.origin.z);

    return dx <= dist && dy <= dist && dz <= dist;
}

export function M_MoveToPath(self: Entity, context: EntitySystem): void {
    const goal = self.goalentity;
    if (goal && goal.target) {
        const next = context.pickTarget(goal.target);
        if (next) {
            self.goalentity = next;
            self.ideal_yaw = vectorToYaw({
                x: next.origin.x - self.origin.x,
                y: next.origin.y - self.origin.y,
                z: next.origin.z - self.origin.z
            });
        }
    }
}

export function M_MoveToGoal(self: Entity, dist: number, context: EntitySystem): boolean {
    const goal = self.goalentity;

    if (!self.groundentity && !((self.flags & (EntityFlags.Swim | EntityFlags.Fly)) !== 0)) {
        return false;
    }

    if (self.enemy && SV_CloseEnough(self, self.enemy, dist)) {
        return true;
    }

    if (goal && goal.classname === 'path_corner') {
         if (SV_CloseEnough(self, goal, dist)) {
             M_MoveToPath(self, context);
             return true;
         }
    }

    if (!SV_StepDirection(self, self.ideal_yaw, dist, context)) {
        return false;
    }

    return true;
}

export function G_IdealHoverPosition(ent: Entity, context: EntitySystem): Vec3 {
  if ((!ent.enemy && !(ent.monsterinfo.aiflags & AIFlags.Medic)) ||
      (ent.monsterinfo.aiflags & (AIFlags.CombatPoint | AIFlags.SoundTarget | AIFlags.HintPath | AIFlags.Pathing))) {
    return { x: 0, y: 0, z: 0 };
  }

  const theta = context.rng.frandom() * 2 * Math.PI;
  let phi: number;

  if (ent.monsterinfo.fly_above) {
    phi = Math.acos(0.7 + context.rng.frandom() * 0.3);
  } else if (ent.monsterinfo.fly_buzzard || (ent.monsterinfo.aiflags & AIFlags.Medic)) {
    phi = Math.acos(context.rng.frandom());
  } else {
    phi = Math.acos(context.rng.crandom() * 0.06);
  }

  const sinPhi = Math.sin(phi);
  const d = {
    x: sinPhi * Math.cos(theta),
    y: sinPhi * Math.sin(theta),
    z: Math.cos(phi),
  };

  const minDist = ent.monsterinfo.fly_min_distance ?? 0;
  const maxDist = ent.monsterinfo.fly_max_distance ?? 0;
  const dist = minDist + context.rng.frandom() * (maxDist - minDist);
  return scaleVec3(d, dist);
}

export function SV_flystep(ent: Entity, move: Vec3, relink: boolean, context: EntitySystem): boolean {
  if (ent.monsterinfo.aiflags & AIFlags.AlternateFly) {
    // TODO: Implement SV_alternate_flystep
    // if (SV_alternate_flystep(ent, move, relink, context)) return true;
  }

  const oldOrg = { ...ent.origin };

  // carrier hack
  let minheight = 40;
  if (ent.classname === 'monster_carrier') minheight = 104;

  for (let i = 0; i < 2; i++) {
    let newMove = { ...move };

    if (i === 0 && ent.enemy) {
      let goalEntity = ent.goalentity;
      if (!goalEntity) goalEntity = ent.enemy;

      // Pathing logic placeholder - simplified
      let goalPos = goalEntity.origin;
      if (ent.monsterinfo.aiflags & AIFlags.Pathing && ent.monsterinfo.nav_path) {
          goalPos = ent.monsterinfo.nav_path.firstMovePoint;
      }

      const dz = ent.origin.z - goalPos.z;
      const dist = lengthVec3(move);

      if (goalEntity.client) {
        if (dz > minheight) {
          newMove = scaleVec3(newMove, 0.5);
          newMove.z -= dist;
        }
        if (!((ent.flags & EntityFlags.Swim) && ent.waterlevel < 2)) { // WATER_WAIST = 2
          if (dz < (minheight - 10)) {
            newMove = scaleVec3(newMove, 0.5);
            newMove.z += dist;
          }
        }
      } else {
        if (ent.classname === 'monster_fixbot') {
            // Fixbot special movement
            // Using simplified logic from reference or just standard fallback for now as fixbot isn't fully implemented
        } else {
          if (dz > 0) {
            newMove = scaleVec3(newMove, 0.5);
            newMove.z -= Math.min(dist, dz);
          } else if (dz < 0) {
            newMove = scaleVec3(newMove, 0.5);
            newMove.z += -Math.max(-dist, dz);
          }
        }
      }
    }

    const newOrg = addVec3(ent.origin, newMove);
    const trace = context.trace(ent.origin, ent.mins, ent.maxs, newOrg, ent, MASK_MONSTERSOLID);

    if (ent.flags & EntityFlags.Fly) {
      if (!ent.waterlevel) {
        const test = { x: trace.endpos.x, y: trace.endpos.y, z: trace.endpos.z + ent.mins.z + 1 };
        if (context.pointcontents(test) & MASK_WATER) return false;
      }
    }

    if (ent.flags & EntityFlags.Swim) {
      if (ent.waterlevel < 2) { // WATER_WAIST
        const test = { x: trace.endpos.x, y: trace.endpos.y, z: trace.endpos.z + ent.mins.z + 1 };
        if (!(context.pointcontents(test) & MASK_WATER)) return false;
      }
    }

    if (trace.fraction === 1 && !trace.allsolid && !trace.startsolid) {
      (ent.origin as MutableVec3).x = trace.endpos.x;
      (ent.origin as MutableVec3).y = trace.endpos.y;
      (ent.origin as MutableVec3).z = trace.endpos.z;

      if (relink) {
        context.linkentity(ent);
      }
      return true;
    }

    if (!ent.enemy) break;
  }

  return false;
}

export function M_droptofloor_generic(
  origin: MutableVec3,
  mins: Vec3,
  maxs: Vec3,
  ceiling: boolean,
  ignore: Entity,
  mask: number,
  allow_partial: boolean,
  context: EntitySystem
): boolean {
  // Check if we start in solid
  // NOTE: origin is modified by ref in C++. Here we mutate the passed object.

  if (context.trace(origin, mins, maxs, origin, ignore, mask).startsolid) {
    if (!ceiling) {
      origin.z += 1;
    } else {
      origin.z -= 1;
    }
  }

  const end = { ...origin };
  if (!ceiling) {
    end.z -= 256;
  } else {
    end.z += 256;
  }

  const trace = context.trace(origin, mins, maxs, end, ignore, mask);

  if (trace.fraction === 1 || trace.allsolid || (!allow_partial && trace.startsolid)) {
    return false;
  }

  origin.x = trace.endpos.x;
  origin.y = trace.endpos.y;
  origin.z = trace.endpos.z;

  return true;
}

export function M_droptofloor(ent: Entity, context: EntitySystem): boolean {
  // Use MASK_MONSTERSOLID generally for monsters as per g_monster.cpp M_droptofloor
  const mask = MASK_MONSTERSOLID; // Or G_GetClipMask(ent) logic

  // SPAWNFLAG_MONSTER_NO_DROP check? Assuming 0x00000000 for now or add to constants if needed
  // Not checking spawnflags for now as they are not fully ported/imported here

  if (!M_droptofloor_generic(ent.origin as MutableVec3, ent.mins, ent.maxs, ent.gravityVector.z > 0, ent, mask, true, context)) {
    return false;
  }

  context.linkentity(ent);
  CheckGround(ent, context);

  // Categorize position updates waterlevel/watertype
  // In C++: M_CatagorizePosition(ent, ent->s.origin, ent->waterlevel, ent->watertype);
  // We can use CheckGround logic or separate categorization if needed.
  // CheckGround already does some of this but M_CatagorizePosition is more thorough.

  return true;
}
