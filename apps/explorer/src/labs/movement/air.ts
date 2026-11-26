// The movement lab's air view: one frame of the game's air move seen from above, and why turning
// while strafing in the air speeds a player up. Pure and DOM-free. The step uses shared's
// applyPmoveAccelerate and applyPmoveAirAccelerate, the same sums the player move runs inline
// (accelerate and airAccelerate in pmove/frame.ts, which rounds each step to a 32-bit float as the
// C does; these work in doubles, a difference far below what the view draws), and takes the same
// branch (PM_AirMove in p_move.cpp): with sv_airaccelerate at 0, as the game ships, PM_Accelerate
// with an acceleration of 1; above 0, PM_AirAccelerate with that value, whose wished speed is
// capped at 30 when it decides how much to add.
//
// The finding the view draws: acceleration only looks at the velocity's part along the wish
// direction (currentspeed = dot(velocity, wishdir)). Point the wish direction far enough from the
// velocity and that part is small, so speed is added, at an angle, and the total grows past
// pm_maxspeed. The angle where the gain is largest is the one a strafe-jumper turns to hold.
import { applyPmoveAccelerate, applyPmoveAirAccelerate } from '@quake2ts/shared/pmove';
import type { LabTuning } from './simulate';

type Vec = { readonly x: number; readonly y: number; readonly z: number };

/** PM_AirAccelerate's cap on the wished speed when it decides how much to add. */
export const AIR_WISH_CAP = 30;
/** The acceleration the air move uses when sv_airaccelerate is 0. */
export const AIR_ACCELERATE_AT_ZERO = 1;

export interface AirFrame {
  /** The velocity before the frame, along +x. */
  readonly velocity: Vec;
  /** The wish direction, a unit vector at `angle` degrees from the velocity. */
  readonly wishdir: Vec;
  /** The speed the keys ask for: pm_maxspeed with strafe held and run on. */
  readonly wishspeed: number;
  /** The wished speed the code compares against: capped at 30 on PM_AirAccelerate's path. */
  readonly comparedSpeed: number;
  /** dot(velocity, wishdir): how much of the velocity already points where the keys ask. */
  readonly currentspeed: number;
  /** comparedSpeed - currentspeed: room left to add. Nothing is added at or below 0. */
  readonly addspeed: number;
  /** What is added along the wish direction this frame. */
  readonly accelspeed: number;
  readonly after: Vec;
  readonly speedBefore: number;
  readonly speedAfter: number;
  /** The acceleration used and the function that used it. */
  readonly accel: number;
  readonly path: 'PM_Accelerate' | 'PM_AirAccelerate';
}

const length2 = (v: Vec) => Math.hypot(v.x, v.y);

/** One air frame at `speed` units per second with the wish direction `angle` degrees off the velocity. */
export function airFrame(speed: number, angle: number, tuning: LabTuning, frameMsec: number): AirFrame {
  const velocity = { x: speed, y: 0, z: 0 };
  const a = (angle * Math.PI) / 180;
  const wishdir = { x: Math.cos(a), y: Math.sin(a), z: 0 };
  const wishspeed = tuning.maxSpeed;
  const frametime = frameMsec / 1000;
  const capped = tuning.airAccelerate > 0;
  const accel = capped ? tuning.airAccelerate : AIR_ACCELERATE_AT_ZERO;
  const after = capped
    ? applyPmoveAirAccelerate({ velocity, wishdir, wishspeed, accel, frametime })
    : applyPmoveAccelerate({ velocity, wishdir, wishspeed, accel, frametime });
  const comparedSpeed = capped ? Math.min(wishspeed, AIR_WISH_CAP) : wishspeed;
  const currentspeed = velocity.x * wishdir.x + velocity.y * wishdir.y;
  const addspeed = comparedSpeed - currentspeed;
  const accelspeed = addspeed <= 0 ? 0 : Math.min(accel * frametime * wishspeed, addspeed);
  return {
    velocity,
    wishdir,
    wishspeed,
    comparedSpeed,
    currentspeed,
    addspeed,
    accelspeed,
    after,
    speedBefore: speed,
    speedAfter: length2(after),
    accel,
    path: capped ? 'PM_AirAccelerate' : 'PM_Accelerate',
  };
}

/** Speed gained in one frame at each angle from 0 to 180 degrees, in steps of `step`. */
export function gainByAngle(speed: number, tuning: LabTuning, frameMsec: number, step = 0.5): { angle: number; gain: number }[] {
  const out: { angle: number; gain: number }[] = [];
  for (let angle = 0; angle <= 180 + 1e-9; angle += step) out.push({ angle, gain: airFrame(speed, angle, tuning, frameMsec).speedAfter - speed });
  return out;
}

/** The angle that gains the most speed in one frame, to `step` degrees. */
export function bestAngle(speed: number, tuning: LabTuning, frameMsec: number, step = 0.1): { angle: number; gain: number } {
  let best = { angle: 0, gain: -Infinity };
  for (const p of gainByAngle(speed, tuning, frameMsec, step)) if (p.gain > best.gain + 1e-12) best = p;
  return best;
}

/** The angles where a frame adds speed: from the first to the last angle with a gain. */
export function gainBand(speed: number, tuning: LabTuning, frameMsec: number): { from: number; to: number } | null {
  const gains = gainByAngle(speed, tuning, frameMsec, 0.1).filter((p) => p.gain > 1e-9);
  return gains.length ? { from: gains[0]!.angle, to: gains.at(-1)!.angle } : null;
}

/**
 * Speed over `seconds` of strafe-jumping: in the air every frame (a jump on the frame of landing
 * keeps all speed, since PM_CheckJump clears the ground before PM_Friction runs), turning so the
 * wish direction holds the best angle each frame. Starts at top running speed.
 */
export function strafeRun(tuning: LabTuning, frameMsec: number, seconds: number): { t: number; speed: number }[] {
  let speed = tuning.maxSpeed;
  const frames = Math.round((seconds * 1000) / frameMsec);
  const out = [{ t: 0, speed }];
  for (let i = 1; i <= frames; i++) {
    speed = airFrame(speed, bestAngle(speed, tuning, frameMsec, 0.5).angle, tuning, frameMsec).speedAfter;
    out.push({ t: (i * frameMsec) / 1000, speed });
  }
  return out;
}
