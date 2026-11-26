/**
 * Support routines for movers, ported from the rerelease g_func.cpp: Move_Calc moves an
 * entity's origin to a point by setting its velocity for whole frames (the pusher physics
 * does the moving), with the rerelease's 40 Hz acceleration curve; AngleMove_Calc does the
 * same for angles. Doors, plats, buttons and trains are built on these.
 */
import type { Vec3 } from '@quake2ts/shared';
import { Entity, EntityFlags, type MoveInfo } from './entity.js';
import type { EntitySystem } from './system.js';

export const STATE_TOP = 0;
export const STATE_BOTTOM = 1;
export const STATE_UP = 2;
export const STATE_DOWN = 3;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const length = (a: Vec3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export function moveinfo(ent: Entity): MoveInfo {
  if (!ent.moveinfo) ent.moveinfo = {};
  return ent.moveinfo;
}

const frameTime = (sys: EntitySystem) => sys.frameTimeSeconds || 0.025;

function moveDone(ent: Entity): void {
  ent.velocity = { ...ZERO };
  ent.moveinfo?.endfunc?.(ent);
}

function moveFinal(ent: Entity, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  if (mi.remaining_distance === 0) {
    moveDone(ent);
    return;
  }
  // [Paril-KEX] use exact remaining distance
  ent.velocity = scale(sub(mi.dest!, ent.origin), 1 / frameTime(sys));
  ent.think = () => moveDone(ent);
  ent.nextthink = sys.timeSeconds + frameTime(sys);
}

function moveBegin(ent: Entity, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  const ft = frameTime(sys);
  const speed = mi.speed ?? 0;
  const remaining = mi.remaining_distance ?? 0;
  if (speed * ft >= remaining) {
    moveFinal(ent, sys);
    return;
  }
  ent.velocity = scale(mi.dir!, speed);
  const frames = Math.floor(remaining / speed / ft);
  mi.remaining_distance = remaining - frames * speed * ft;
  ent.nextthink = sys.timeSeconds + ft * frames;
  ent.think = () => moveFinal(ent, sys);
}

/** The entity G_RunFrame is running now is this mover's team captain. */
function isCurrent(ent: Entity, sys: EntitySystem): boolean {
  return sys.currentEntity === (ent.flags & EntityFlags.TeamSlave ? ent.teammaster : ent);
}

function accelerationDistance(target: number, rate: number): number {
  return (target * (target / rate + 1)) / 2;
}

/** plat_CalcAcceleratedMove */
export function calcAcceleratedMove(mi: MoveInfo): void {
  const speed = mi.speed ?? 0;
  const accel = mi.accel ?? 0;
  const decel = mi.decel ?? 0;
  const remaining = mi.remaining_distance ?? 0;
  if (remaining < accel) {
    mi.move_speed = speed;
    mi.current_speed = remaining;
    return;
  }
  const accelDist = accelerationDistance(speed, accel);
  let decelDist = accelerationDistance(speed, decel);
  if (remaining - accelDist - decelDist < 0) {
    const f = (accel + decel) / (accel * decel);
    mi.move_speed = mi.current_speed = (-2 + Math.sqrt(4 - 4 * f * (-2 * remaining))) / (2 * f);
    decelDist = accelerationDistance(mi.move_speed, decel);
  } else {
    mi.move_speed = speed;
  }
  mi.decel_distance = decelDist;
}

/** plat_Accelerate */
export function accelerate(mi: MoveInfo): void {
  const remaining = mi.remaining_distance ?? 0;
  const decelDistance = mi.decel_distance ?? 0;
  const decel = mi.decel ?? 0;
  const moveSpeed = mi.move_speed ?? 0;
  let current = mi.current_speed ?? 0;

  // Decelerating?
  if (remaining <= decelDistance) {
    if (remaining < decelDistance) {
      if (mi.next_speed) {
        mi.current_speed = mi.next_speed;
        mi.next_speed = 0;
        return;
      }
      if (current > decel) {
        current -= decel;
        // [Paril-KEX] fix platforms in xdm6, etc
        if (Math.abs(current) < 0.01) current = remaining + 1;
        mi.current_speed = current;
      }
    }
    return;
  }

  // At full speed and due to start slowing during this move?
  if (current === moveSpeed && remaining - current < decelDistance) {
    const p1 = remaining - decelDistance;
    const p2 = moveSpeed * (1 - p1 / moveSpeed);
    const distance = p1 + p2;
    mi.current_speed = moveSpeed;
    mi.next_speed = moveSpeed - decel * (p2 / distance);
    return;
  }

  // Accelerating?
  const speed = mi.speed ?? 0;
  if (current < speed) {
    const oldSpeed = current;
    current += mi.accel ?? 0;
    if (current > speed) current = speed;
    mi.current_speed = current;

    // Accelerating through the whole move?
    if (remaining - current >= decelDistance) return;

    // This move speeds up to move_speed and crosses decel_distance: average the two parts.
    const p1 = remaining - decelDistance;
    const p1Speed = (oldSpeed + moveSpeed) / 2;
    const p2 = moveSpeed * (1 - p1 / p1Speed);
    const distance = p1 + p2;
    mi.current_speed = p1Speed * (p1 / distance) + moveSpeed * (p2 / distance);
    mi.next_speed = moveSpeed - decel * (p2 / distance);
  }
  // Otherwise at constant velocity.
}

/** Think_AccelMove_MoveInfo: steps the 10 Hz acceleration; false when the move ends next step. */
function accelMoveInfo(mi: MoveInfo): boolean {
  if (!mi.current_speed) calcAcceleratedMove(mi); // starting or blocked
  accelerate(mi);
  return (mi.remaining_distance ?? 0) > (mi.current_speed ?? 0);
}

/** Think_AccelMove_New: follows the precomputed 10 Hz curve, interpolating between its frames. */
function accelMoveNew(ent: Entity, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  const positions = mi.curve_positions ?? [];
  let targetDist: number;
  if (mi.num_subframes) {
    if (mi.subframe === mi.num_subframes + 1) {
      mi.subframe = 0;
      mi.curve_frame = (mi.curve_frame ?? 0) + 1;
      if (mi.curve_frame === positions.length) {
        moveFinal(ent, sys);
        return;
      }
    }
    const t = ((mi.subframe ?? 0) + 1) / (mi.num_subframes + 1);
    const frame = mi.curve_frame ?? 0;
    targetDist = positions[frame - 1] + (positions[frame] - positions[frame - 1]) * t;
    mi.subframe = (mi.subframe ?? 0) + 1;
  } else {
    if (mi.curve_frame === positions.length) {
      moveFinal(ent, sys);
      return;
    }
    targetDist = positions[mi.curve_frame ?? 0];
    mi.curve_frame = (mi.curve_frame ?? 0) + 1;
  }
  mi.num_frames_done = (mi.num_frames_done ?? 0) + 1;
  const target = add(mi.curve_ref!, scale(mi.dir!, targetDist));
  ent.velocity = scale(sub(target, ent.origin), 1 / frameTime(sys));
  ent.nextthink = sys.timeSeconds + frameTime(sys);
}

/**
 * Move_Calc: moves ent to dest at moveinfo.speed (accelerating and slowing by
 * moveinfo.accel and decel when they differ from the speed), then calls endfunc.
 */
export function moveCalc(ent: Entity, dest: Vec3, endfunc: (ent: Entity) => void, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  ent.velocity = { ...ZERO };
  mi.dest = { ...dest };
  const dir = sub(dest, ent.origin);
  const len = length(dir);
  mi.dir = len ? scale(dir, 1 / len) : { ...ZERO };
  mi.remaining_distance = len;
  mi.endfunc = endfunc;

  if (mi.speed === mi.accel && mi.speed === mi.decel) {
    // Move_Regular
    if (isCurrent(ent, sys)) {
      moveBegin(ent, sys);
    } else {
      ent.nextthink = sys.timeSeconds + frameTime(sys);
      ent.think = () => moveBegin(ent, sys);
    }
    return;
  }

  // Accelerative: simulate the 10 Hz movement once, then follow it at the tick rate.
  mi.current_speed = 0;
  mi.num_subframes = Math.round(0.1 / frameTime(sys)) - 1;
  const total = len;
  const distances: number[] = [];
  if (mi.num_subframes) {
    distances.push(0);
    mi.curve_frame = 1;
  } else {
    mi.curve_frame = 0;
  }
  while (mi.remaining_distance) {
    if (!accelMoveInfo(mi)) break;
    mi.remaining_distance -= mi.current_speed ?? 0;
    distances.push(total - mi.remaining_distance);
  }
  if (mi.num_subframes) distances.push(total);

  mi.subframe = 0;
  mi.curve_ref = { ...ent.origin };
  mi.curve_positions = distances;
  mi.num_frames_done = 0;
  ent.think = () => accelMoveNew(ent, sys);
  ent.nextthink = sys.timeSeconds + frameTime(sys);
}

function angleMoveDone(ent: Entity): void {
  ent.avelocity = { ...ZERO };
  ent.moveinfo?.endfunc?.(ent);
}

function angleTarget(ent: Entity): Vec3 {
  const mi = moveinfo(ent);
  if (mi.state === STATE_UP) return mi.reversing ? mi.end_angles_reversed! : mi.end_angles!;
  return mi.start_angles!;
}

function angleMoveFinal(ent: Entity, sys: EntitySystem): void {
  const move = sub(angleTarget(ent), ent.angles);
  if (!move.x && !move.y && !move.z) {
    angleMoveDone(ent);
    return;
  }
  ent.avelocity = scale(move, 1 / frameTime(sys));
  ent.think = () => angleMoveDone(ent);
  ent.nextthink = sys.timeSeconds + frameTime(sys);
}

function angleMoveBegin(ent: Entity, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  const ft = frameTime(sys);
  // PGM: accelerate as needed
  if ((mi.speed ?? 0) < ent.speed) {
    mi.speed = (mi.speed ?? 0) + ent.accel;
    if (mi.speed > ent.speed) mi.speed = ent.speed;
  }
  const destdelta = sub(angleTarget(ent), ent.angles);
  const len = length(destdelta);
  const traveltime = len / (mi.speed ?? 0);
  if (traveltime < ft) {
    angleMoveFinal(ent, sys);
    return;
  }
  const frames = Math.floor(traveltime / ft);
  ent.avelocity = scale(destdelta, 1 / traveltime);
  if ((mi.speed ?? 0) >= ent.speed) {
    ent.nextthink = sys.timeSeconds + ft * frames;
    ent.think = () => angleMoveFinal(ent, sys);
  } else {
    ent.nextthink = sys.timeSeconds + ft;
    ent.think = () => angleMoveBegin(ent, sys);
  }
}

/** AngleMove_Calc: turns ent to the angles its moveinfo.state points at, then calls endfunc. */
export function angleMoveCalc(ent: Entity, endfunc: (ent: Entity) => void, sys: EntitySystem): void {
  const mi = moveinfo(ent);
  ent.avelocity = { ...ZERO };
  mi.endfunc = endfunc;
  // PGM: if we're supposed to accelerate, this tells angleMoveBegin to.
  if (ent.accel !== ent.speed) mi.speed = 0;
  if (isCurrent(ent, sys)) {
    angleMoveBegin(ent, sys);
  } else {
    ent.nextthink = sys.timeSeconds + frameTime(sys);
    ent.think = () => angleMoveBegin(ent, sys);
  }
}
