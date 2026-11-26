import { M_CheckGround, M_droptofloor as dropToFloor } from './monsterStart.js';
import { getClipMask } from '../physics/pusher.js';
import { angleMod, degToRad, vectorToYaw, addVec3, scaleVec3, lengthVec3 } from '@quake2ts/shared';
import type { Vec3 } from '@quake2ts/shared';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { MoveType, EntityFlags } from '../entities/entity.js';
import { MASK_MONSTERSOLID, MASK_WATER, CONTENTS_SOLID, CONTENTS_WATER, CONTENTS_SLIME, CONTENTS_LAVA } from '@quake2ts/shared';
import { AIFlags, BOTTOM_EMPTY, BOTTOM_SOLID, BOTTOM_WATER, BOTTOM_SLIME, BOTTOM_LAVA, AttackState } from './constants.js';

// The rerelease g_ai.cpp and m_move.cpp ports. These names are what monster files import.
export { ai_move, ai_stand, ai_walk, ai_turn, ai_run, ai_charge, ai_run_slide } from './g_ai.js';
export {
  M_ChangeYaw,
  FacingIdeal as facingIdeal,
  M_CheckBottom,
  SV_movestep as M_MoveStep,
  M_walkmove,
  SV_StepDirection,
  SV_NewChaseDir,
  M_MoveToGoal,
} from './m_move.js';

export type MutableVec3 = { x: number; y: number; z: number };

const STEPSIZE = 18;
const MONSTER_TICK = 0.1;
const MAX_SIDESTEP = 8.0;

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


function setIdealYawTowards(self: Entity, target: Entity | null): void {
  if (!target) return;

  const toTarget: Vec3 = {
    x: target.origin.x - self.origin.x,
    y: target.origin.y - self.origin.y,
    z: target.origin.z - self.origin.z,
  };
  self.ideal_yaw = vectorToYaw(toTarget);
}

export function monster_done_dodge(self: Entity): void {
  self.monsterinfo.aiflags &= ~AIFlags.Dodging;
  self.monsterinfo.attack_state = AttackState.Straight;
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

/** M_CheckGround with the entity's own clip mask (G_GetClipMask), as M_MoveStep calls it. */
export function CheckGround(self: Entity, context: EntitySystem): void {
  M_CheckGround(self, getClipMask(self), context);
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
  // Check if gravityVector exists before accessing it (backwards compatibility for tests that mock Entity without it)
  const ceiling = self.gravityVector ? self.gravityVector.z > 0 : false;

  // Fast check: if all corners are in solid, we are good
  let allSolid = true;
  for (let x = 0; x <= 1; x++) {
    for (let y = 0; y <= 1; y++) {
      start.x = x ? maxs.x : mins.x;
      start.y = y ? maxs.y : mins.y;
      if (ceiling) {
        start.z = maxs.z + 1;
      } else {
        start.z = mins.z - 1;
      }

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

  const stop = { ...start };

  if (ceiling) {
    start.z = self.origin.z + self.maxs.z;
    stop.z = start.z + STEPSIZE * 2;
  } else {
    start.z = self.origin.z + self.mins.z;
    stop.z = start.z - STEPSIZE * 2;
  }

  const mins_no_z = { ...self.mins, z: 0 };
  const maxs_no_z = { ...self.maxs, z: 0 };

  const trace = context.trace(start, mins_no_z, maxs_no_z, stop, self, MASK_MONSTERSOLID);

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

        if (ceiling) {
             if (subTrace.fraction === 1.0 || subTrace.endpos.z - mid > STEPSIZE) {
                return BOTTOM_EMPTY;
             }
        } else {
             if (subTrace.fraction === 1.0 || mid - subTrace.endpos.z > STEPSIZE) {
                return BOTTOM_EMPTY;
             }
        }
    }
  }

  return result;
}


function getGravityVector(ent: Entity): Vec3 {
  if (ent.gravityVector && lengthVec3(ent.gravityVector) > 0.001) {
    return ent.gravityVector;
  }
  return { x: 0, y: 0, z: -1 };
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
  return dropToFloor(ent, context);
}
