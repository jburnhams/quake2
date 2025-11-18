import type { Vec3 } from '../math/vec3.js';
import { lengthVec3, scaleVec3, dotVec3 } from '../math/vec3.js';
import type { PmoveAccelerateParams, PmoveFrictionParams } from './types.js';

/**
 * Pure version of PM_Friction from rerelease p_move.cpp.
 * Handles ground and water friction and returns a new velocity.
 */
export function applyPmoveFriction(params: PmoveFrictionParams): Vec3 {
  const {
    velocity,
    frametime,
    onGround,
    groundIsSlick,
    onLadder,
    waterlevel,
    pmFriction,
    pmStopSpeed,
    pmWaterFriction,
  } = params;

  const speed = lengthVec3(velocity);

  // Matches the "if (speed < 1)" early-out: clears X/Y but preserves Z.
  if (speed < 1) {
    return { x: 0, y: 0, z: velocity.z };
  }

  let drop = 0;

  // Ground friction (or ladder)
  if ((onGround && !groundIsSlick) || onLadder) {
    const control = speed < pmStopSpeed ? pmStopSpeed : speed;
    const friction = pmFriction;
    drop += control * friction * frametime;
  }

  // Water friction (only when not on ladder)
  if (waterlevel > 0 && !onLadder) {
    drop += speed * pmWaterFriction * waterlevel * frametime;
  }

  let newspeed = speed - drop;
  if (newspeed < 0) {
    newspeed = 0;
  }

  if (newspeed === speed) {
    return velocity;
  }

  const scale = newspeed / speed;
  return scaleVec3(velocity, scale);
}

/**
 * Pure version of PM_Accelerate from rerelease p_move.cpp.
 * Returns a new velocity with wishdir/wishspeed acceleration applied.
 */
export function applyPmoveAccelerate(params: PmoveAccelerateParams): Vec3 {
  const { velocity, wishdir, wishspeed, accel, frametime } = params;

  const currentSpeed = dotVec3(velocity, wishdir);
  const addSpeed = wishspeed - currentSpeed;

  if (addSpeed <= 0) {
    return velocity;
  }

  let accelSpeed = accel * frametime * wishspeed;
  if (accelSpeed > addSpeed) {
    accelSpeed = addSpeed;
  }

  return {
    x: velocity.x + wishdir.x * accelSpeed,
    y: velocity.y + wishdir.y * accelSpeed,
    z: velocity.z + wishdir.z * accelSpeed,
  };
}

/**
 * Mirrors PM_AirAccelerate in rerelease `p_move.cpp` (lines ~612-636): wishspeed is clamped
 * to 30 for the addspeed calculation but the acceleration magnitude still uses the full wishspeed.
 */
export function applyPmoveAirAccelerate(params: PmoveAccelerateParams): Vec3 {
  const { velocity, wishdir, wishspeed, accel, frametime } = params;

  const wishspd = Math.min(wishspeed, 30);
  const currentSpeed = dotVec3(velocity, wishdir);
  const addSpeed = wishspd - currentSpeed;

  if (addSpeed <= 0) {
    return velocity;
  }

  let accelSpeed = accel * wishspeed * frametime;
  if (accelSpeed > addSpeed) {
    accelSpeed = addSpeed;
  }

  return {
    x: velocity.x + wishdir.x * accelSpeed,
    y: velocity.y + wishdir.y * accelSpeed,
    z: velocity.z + wishdir.z * accelSpeed,
  };
}
