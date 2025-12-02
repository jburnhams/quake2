import type { Vec3 } from '../math/vec3.js';
import { addVec3, dotVec3, lengthVec3, normalizeVec3, scaleVec3 } from '../math/vec3.js';
import type {
  PmoveAccelerateParams,
  PmoveCmd,
  PmoveFrictionParams,
  PmoveWishParams,
  PmoveWishResult,
} from './types.js';

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

/**
 * Pure mirror of PM_CmdScale from rerelease `p_move.cpp`. Computes the scalar applied to
 * the command directional inputs so that the resulting wish velocity caps at `maxSpeed`
 * regardless of the directional mix.
 */
export function pmoveCmdScale(cmd: PmoveCmd, maxSpeed: number): number {
  const forward = Math.abs(cmd.forwardmove);
  const side = Math.abs(cmd.sidemove);
  const up = Math.abs(cmd.upmove);

  const max = Math.max(forward, side, up);
  if (max === 0) {
    return 0;
  }

  const total = Math.sqrt(cmd.forwardmove * cmd.forwardmove + cmd.sidemove * cmd.sidemove + cmd.upmove * cmd.upmove);
  return (maxSpeed * max) / (127 * total);
}

/**
 * Computes wishdir/wishspeed for ground/air movement as done in PM_AirMove and
 * PM_GroundMove. Z is forced to zero and wishspeed is clamped to maxSpeed, matching
 * the rerelease p_move.cpp helpers before they call PM_Accelerate/PM_AirAccelerate.
 */
export function buildAirGroundWish(params: PmoveWishParams): PmoveWishResult {
  const { forward, right, cmd, maxSpeed } = params;

  let wishvel = {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: 0,
  } satisfies Vec3;

  let wishspeed = lengthVec3(wishvel);
  if (wishspeed > maxSpeed) {
    const scale = maxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = maxSpeed;
  }

  return {
    wishdir: wishspeed === 0 ? wishvel : normalizeVec3(wishvel),
    wishspeed,
  };
}

/**
 * Computes the wishdir/wishspeed mix for water movement, matching PM_WaterMove in
 * rerelease p_move.cpp: includes the upward bias when no strong upmove is requested,
 * clamps wishspeed to maxSpeed, and halves the returned wishspeed before acceleration.
 */
export function buildWaterWish(params: PmoveWishParams): PmoveWishResult {
  const { forward, right, cmd, maxSpeed } = params;

  // Use full 3D components for water movement
  let wishvel = {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: forward.z * cmd.forwardmove + right.z * cmd.sidemove,
  } satisfies Vec3;

  if (cmd.upmove > 10) {
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: cmd.upmove });
  } else if (cmd.upmove < -10) {
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: cmd.upmove });
  } else if (Math.abs(cmd.forwardmove) < 10 && Math.abs(cmd.sidemove) < 10) {
    // Standard drift down when no vertical input AND no significant horizontal input
    // Matches Quake 2 rerelease behavior (sinking slowly)
    wishvel = addVec3(wishvel, { x: 0, y: 0, z: -60 });
  }

  let wishspeed = lengthVec3(wishvel);
  if (wishspeed > maxSpeed) {
    const scale = maxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = maxSpeed;
  }

  wishspeed *= 0.5;

  return {
    wishdir: wishspeed === 0 ? wishvel : normalizeVec3(wishvel),
    wishspeed,
  };
}
