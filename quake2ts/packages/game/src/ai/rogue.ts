import {
  Entity,
  MoveType,
  Solid,
  DeadFlag,
  EntityFlags,
  AiFlags,
  MonsterMove
} from '../entities/entity.js';
import {
  Vec3,
  ZERO_VEC3,
  addVec3,
  scaleVec3,
  subtractVec3,
  normalizeVec3,
  vectorToAngles,
  angleVectors,
  lengthVec3,
  copyVec3,
  dotVec3,
  crossVec3,
  MASK_SHOT,
  MASK_SOLID,
  MASK_MONSTERSOLID,
  MASK_WATER,
  CONTENTS_WATER,
  CONTENTS_SOLID,
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  CONTENTS_DEADMONSTER,
  RAD2DEG
} from '@quake2ts/shared';
import { EntitySystem } from '../entities/system.js';
import { M_CheckBottom, CheckGround, walkMove, changeYaw, facingIdeal } from './movement.js';
import { visible, rangeTo } from './perception.js';
import { M_SetAnimation } from '../entities/monsters/common.js';
// Removed checkWater import as it is not readily available or needed for basic logic yet

const STEPSIZE = 18;
const MONSTER_TICK = 0.1;

// ============================================================================
// PredictAim
// ============================================================================

/**
 * Predictive calculator
 * target is who you want to shoot
 * start is where the shot comes from
 * bolt_speed is how fast the shot is (or 0 for hitscan)
 * eye_height is a boolean to say whether or not to adjust to targets eye_height
 * offset is how much time to miss by
 * aimdir is the resulting aim direction
 * aimpoint is the resulting aimpoint
 */
export function PredictAim(
  context: EntitySystem,
  self: Entity,
  target: Entity,
  start: Vec3,
  bolt_speed: number,
  eye_height: boolean,
  offset: number
): { aimdir: Vec3, aimpoint: Vec3 } {

  if (!target || !target.inUse) {
    return { aimdir: { ...ZERO_VEC3 }, aimpoint: { ...ZERO_VEC3 } };
  }

  let dir = subtractVec3(target.origin, start);
  if (eye_height) {
    // dir.z += (target.viewheight || 0); // Readonly
    dir = { ...dir, z: dir.z + (target.viewheight || 0) };
  }
  let dist = lengthVec3(dir);

  // [Paril-KEX] if our current attempt is blocked, try the opposite one
  // MASK_PROJECTILE equivalent? Usually MASK_SHOT includes projectiles.
  // rerelease uses MASK_PROJECTILE which is MASK_SHOT | CONTENTS_HITBOX usually.
  const tr = context.trace(start, null, null, addVec3(start, dir), self, MASK_SHOT);

  if (tr.ent !== target) {
    eye_height = !eye_height;
    dir = subtractVec3(target.origin, start);
    if (eye_height) {
      // dir.z += (target.viewheight || 0); // Readonly
      dir = { ...dir, z: dir.z + (target.viewheight || 0) };
    }
    dist = lengthVec3(dir);
  }

  let time = 0;
  if (bolt_speed) {
    time = dist / bolt_speed;
  }

  // target position prediction: origin + velocity * (time - offset)
  const predictionTime = time - offset;
  let vec: Vec3 = addVec3(target.origin, scaleVec3(target.velocity, predictionTime));

  // went backwards...
  const dirNorm = normalizeVec3(dir);
  const vecDir = normalizeVec3(subtractVec3(vec, start));

  if (dotVec3(dirNorm, vecDir) < 0) {
    vec = { ...target.origin };
  } else {
    // if the shot is going to impact a nearby wall from our prediction, just fire it straight.
    const wallTrace = context.trace(start, null, null, vec, null, MASK_SOLID);
    if (wallTrace.fraction < 0.9) {
      vec = { ...target.origin };
    }
  }

  if (eye_height) {
    // vec.z += (target.viewheight || 0); // Readonly
    vec = { ...vec, z: vec.z + (target.viewheight || 0) };
  }

  const aimdir = normalizeVec3(subtractVec3(vec, start));
  const aimpoint = vec;

  return { aimdir, aimpoint };
}

// ============================================================================
// M_CalculatePitchToFire
// ============================================================================

function clipVelocity(inVec: Vec3, normal: Vec3, overbounce: number): Vec3 {
  const backoff = dotVec3(inVec, normal) * overbounce;
  return {
    x: inVec.x - normal.x * backoff,
    y: inVec.y - normal.y * backoff,
    z: inVec.z - normal.z * backoff
  };
}

/**
 * [Paril-KEX] find a pitch that will at some point land on or near the player.
 * very approximate. aim will be adjusted to the correct aim vector.
 * Returns true if a valid pitch was found and updates `aim` vector in place (by returning it).
 */
export function M_CalculatePitchToFire(
  context: EntitySystem,
  self: Entity,
  target: Vec3,
  start: Vec3,
  speed: number,
  time_remaining: number,
  mortar: boolean,
  destroy_on_touch: boolean = false,
  gravity: number = 800 // Default gravity
): { aimDir: Vec3 } | null {

  const aimVec = normalizeVec3(subtractVec3(target, start));
  const baseAngles = vectorToAngles(aimVec);

  const pitches = [-80, -70, -60, -50, -40, -30, -20, -10, -5];
  let best_pitch = 0;
  let best_dist = Infinity;

  const sim_time = 0.1;
  let found = false;

  for (const pitch of pitches) {
    if (mortar && pitch >= -30) {
      break;
    }

    const pitched_aim = { ...baseAngles, x: pitch };
    const { forward: fwd } = angleVectors(pitched_aim);

    let velocity = scaleVec3(fwd, speed);
    let origin = { ...start };
    let t = time_remaining;
    let hit = false;
    let hitSomething = false;

    while (t > 0) {
      // Apply gravity: velocity.z -= gravity * sim_time
      velocity = { ...velocity, z: velocity.z - gravity * sim_time };

      const end = addVec3(origin, scaleVec3(velocity, sim_time));
      const tr = context.trace(origin, null, null, end, null, MASK_SHOT);

      origin = tr.endpos;

      if (tr.fraction < 1.0) {
        if (tr.surfaceFlags && (tr.surfaceFlags & 4)) { // SURF_SKY = 4 usually
          break;
        }

        // origin += tr.plane.normal (nudge off surface)
        if (tr.plane) {
           origin = addVec3(origin, tr.plane.normal);
           velocity = clipVelocity(velocity, tr.plane.normal, 1.6);
        }

        const dist = lengthVec3(subtractVec3(origin, target)); // Squared distance comparison is faster but length is fine here
        const distSq = dist * dist;

        // Check if we hit the target or close enough
        // tr.ent == self.enemy (we don't have self.enemy here, we just have target pos? Wait, target is Vec3 in arg)
        // Re-reading signature: target is Vec3. So we compare distance.
        // Also check if tr.ent is valid?

        // Logic from C: if (tr.ent == self->enemy || tr.ent->client || (tr.plane.normal.z >= 0.7f && dist < (128.f * 128.f) && dist < best_dist))
        // We can't check tr.ent == self.enemy easily unless we pass enemy.
        // But we can check if tr.ent exists and is client or damageable?
        // For simplicity: check distance to passed target vector.

        // tr.ent check for 'player' (client)
        const hitEnemy = (tr.ent && tr.ent === self.enemy) || (tr.ent && (tr.ent.svflags & 8) !== 0); // ServerFlags.Player = 8

        if (hitEnemy || (tr.plane && tr.plane.normal.z >= 0.7 && distSq < (128 * 128) && distSq < best_dist)) {
           best_pitch = pitch;
           best_dist = distSq;
           found = true;
        }

        if (destroy_on_touch || (tr.contents & (CONTENTS_MONSTER | CONTENTS_PLAYER | CONTENTS_DEADMONSTER))) {
           hitSomething = true;
           break;
        }
      }

      t -= sim_time;
      if (hitSomething) break;
    }
  }

  if (best_dist !== Infinity) {
    const pitched_aim = { ...baseAngles, x: best_pitch };
    const aimDir = angleVectors(pitched_aim).forward;
    return { aimDir };
  }

  return null;
}

// ============================================================================
// Blocked Logic (Jumping & Plats)
// ============================================================================

export enum BlockedJumpResult {
  NO_JUMP = 0,
  JUMP_TURN = 1,
  JUMP_JUMP_UP = 2,
  JUMP_JUMP_DOWN = 3
}

export function blocked_checkplat(context: EntitySystem, self: Entity, dist: number): boolean {
  if (!self.enemy) return false;

  let playerPosition = 0;
  if (self.enemy.absmin.z >= self.absmax.z) playerPosition = 1;
  else if (self.enemy.absmax.z <= self.absmin.z) playerPosition = -1;
  else playerPosition = 0;

  if (playerPosition === 0) return false;

  let plat: Entity | null = null;

  // see if we're already standing on a plat.
  if (self.groundentity && self.groundentity !== context.world) {
    if (self.groundentity.classname && self.groundentity.classname.startsWith('func_plat')) {
      plat = self.groundentity;
    }
  }

  // if we're not, check to see if we'll step onto one with this move
  if (!plat) {
    const { forward } = angleVectors(self.angles);
    const pt1 = addVec3(self.origin, scaleVec3(forward, dist));
    const pt2 = { ...pt1, z: pt1.z - 384 };

    const trace = context.trace(pt1, null, null, pt2, self, MASK_MONSTERSOLID);
    if (trace.fraction < 1 && !trace.allsolid && !trace.startsolid && trace.ent) {
      if (trace.ent.classname && trace.ent.classname.startsWith('func_plat')) {
        plat = trace.ent;
      }
    }
  }

  // if we've found a plat, trigger it.
  if (plat && plat.use) {
    const STATE_TOP = 0;
    const STATE_BOTTOM = 1;
    const STATE_UP = 2;
    const STATE_DOWN = 3;

    // We assume plat has moveinfo.state. In TS port this might be on plat directly or moveinfo object.
    // Assuming plat.moveinfo exists.
    const platState = (plat as any).moveinfo?.state;

    if (playerPosition === 1) { // Player is above
      if ((self.groundentity === plat && platState === STATE_BOTTOM) ||
          (self.groundentity !== plat && platState === STATE_TOP)) {
          plat.use(plat, self, self);
          return true;
      }
    } else if (playerPosition === -1) { // Player is below
      if ((self.groundentity === plat && platState === STATE_TOP) ||
          (self.groundentity !== plat && platState === STATE_BOTTOM)) {
          plat.use(plat, self, self);
          return true;
      }
    }
  }

  return false;
}

export function monster_jump_start(context: EntitySystem, self: Entity): void {
  // monster_done_dodge(self); // TODO: implement if needed
  // Check if we are dodging, if so stop dodging?
  // aiflags not fully exposed in types for 'Dodging' yet?
  // Let's assume AiFlags needs update or we skip for now.

  self.monsterinfo.jump_time = context.timeSeconds + 3.0;
}

export function monster_jump_finished(context: EntitySystem, self: Entity): boolean {
  const { forward } = angleVectors(self.angles);

  // project velocity onto forward
  const forwardVelocityVal = dotVec3(self.velocity, forward);

  if (forwardVelocityVal < 150) {
      const z_velocity = self.velocity.z;
      const newVel = scaleVec3(forward, 150);
      self.velocity = { ...newVel, z: z_velocity };
  }

  return (self.monsterinfo.jump_time || 0) < context.timeSeconds;
}

export function blocked_checkjump(context: EntitySystem, self: Entity, dist: number, dropHeightInput?: number, jumpHeightInput?: number): BlockedJumpResult {
  // Check jump capability via jump_height or drop_height
  // Use passed inputs if available (to match C++ args often passed) or fallback to monsterinfo
  const jumpHeight = jumpHeightInput ?? (self.monsterinfo?.jump_height || 0);
  const dropHeight = dropHeightInput ?? (self.monsterinfo?.drop_height || 0);

  if (!jumpHeight && !dropHeight) // fallback check
      return BlockedJumpResult.NO_JUMP;

  // no enemy to path to
  if (!self.enemy) return BlockedJumpResult.NO_JUMP;

  // we just jumped recently, don't try again
  if (self.monsterinfo.jump_time && self.monsterinfo.jump_time > context.timeSeconds)
      return BlockedJumpResult.NO_JUMP;

  // Pathing logic omitted for now

  let playerPosition = 0;
  const { forward, up } = angleVectors(self.angles);

  if (self.enemy.absmin.z > (self.absmin.z + STEPSIZE)) playerPosition = 1;
  else if (self.enemy.absmin.z < (self.absmin.z - STEPSIZE)) playerPosition = -1;
  else playerPosition = 0;

  if (playerPosition === -1 && dropHeight) {
     // Check drop
     const pt1 = addVec3(self.origin, scaleVec3(forward, 48));
     const trace1 = context.trace(self.origin, self.mins, self.maxs, pt1, self, MASK_MONSTERSOLID);

     if (trace1.fraction < 1) return BlockedJumpResult.NO_JUMP;

     const pt2 = { ...pt1, z: self.absmin.z - dropHeight - 1 };

     const trace2 = context.trace(pt1, null, null, pt2, self, MASK_MONSTERSOLID | MASK_WATER);

     if (trace2.fraction < 1 && !trace2.allsolid && !trace2.startsolid) {
         // check water
         if (trace2.contents & CONTENTS_WATER) {
             const deep = context.trace(trace2.endpos, null, null, pt2, self, MASK_MONSTERSOLID);
             // check depth... simplistic here.
         }

         if ((self.absmin.z - trace2.endpos.z) >= 24 && (trace2.contents & (MASK_SOLID | CONTENTS_WATER))) {
              if ((self.enemy.absmin.z - trace2.endpos.z) > 32) return BlockedJumpResult.NO_JUMP;

              if (trace2.plane && trace2.plane.normal.z < 0.9) return BlockedJumpResult.NO_JUMP;

              monster_jump_start(context, self);
              return BlockedJumpResult.JUMP_JUMP_DOWN;
         }
     }

  } else if (playerPosition === 1 && jumpHeight) {
     const pt1 = addVec3(self.origin, scaleVec3(forward, 48));
     const pt2 = { ...pt1, z: self.absmax.z + jumpHeight };

     const trace = context.trace(pt1, null, null, pt2, self, MASK_MONSTERSOLID | MASK_WATER);
     if (trace.fraction < 1 && !trace.allsolid && !trace.startsolid) {
         if ((trace.endpos.z - self.absmin.z) <= jumpHeight && (trace.contents & (MASK_SOLID | CONTENTS_WATER))) {
             // face_wall(self); // Turn to face wall?
             monster_jump_start(context, self);
             return BlockedJumpResult.JUMP_JUMP_UP;
         }
     }
  }

  return BlockedJumpResult.NO_JUMP;
}
