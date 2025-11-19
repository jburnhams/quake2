import { addVec3, lengthVec3, normalizeVec3, scaleVec3, type Vec3 } from '../math/vec3.js';
import { PlayerButton } from './constants.js';
import { applyPmoveAccelerate } from './pmove.js';
import { stepSlideMove, type StepSlideMoveOutcome } from './slide.js';
import type { PmoveCmd, PmoveTraceFn } from './types.js';

const FLY_FRICTION_MULTIPLIER = 1.5;
const BUTTON_VERTICAL_SCALE = 0.5;
const DEFAULT_OVERBOUNCE = 1.01;

export interface FlyMoveParams {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly cmd: PmoveCmd;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly frametime: number;
  readonly pmFriction: number;
  readonly pmStopSpeed: number;
  readonly pmMaxSpeed: number;
  readonly pmAccelerate: number;
  readonly pmWaterSpeed: number;
  readonly doclip: boolean;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
  readonly trace?: PmoveTraceFn;
  readonly overbounce?: number;
  readonly stepSize?: number;
  readonly maxBumps?: number;
  readonly maxClipPlanes?: number;
}

export type FlyMoveResult = StepSlideMoveOutcome;

/**
 * Pure translation of PM_FlyMove from rerelease `p_move.cpp`: applies the
 * spectator/noclip friction and acceleration rules, then either advances the
 * origin freely or resolves movement through `stepSlideMove` when clipping is
 * requested. This keeps the spectator and noclip physics deterministic between
 * the client and server.
 */
export function applyPmoveFlyMove(params: FlyMoveParams): FlyMoveResult {
  const {
    origin,
    cmd,
    frametime,
    pmFriction,
    pmStopSpeed,
    pmMaxSpeed,
    pmAccelerate,
    pmWaterSpeed,
    doclip,
    forward,
    right,
    mins,
    maxs,
    trace,
    overbounce = DEFAULT_OVERBOUNCE,
    stepSize,
    maxBumps,
    maxClipPlanes,
  } = params;

  let velocity = applyFlyFriction({ velocity: params.velocity, pmFriction, pmStopSpeed, frametime });

  const wishdirVelocity = buildFlyWishVelocity({
    cmd,
    forward,
    right,
    pmMaxSpeed,
    pmWaterSpeed,
  });

  if (wishdirVelocity.wishspeed > 0) {
    velocity = applyPmoveAccelerate({
      velocity,
      wishdir: wishdirVelocity.wishdir,
      wishspeed: wishdirVelocity.accelSpeed,
      accel: pmAccelerate,
      frametime,
    });
  }

  if (!doclip) {
    const originDelta = scaleVec3(velocity, frametime);
    const nextOrigin = addVec3(origin, originDelta);
    return {
      origin: nextOrigin,
      velocity,
      planes: [],
      blocked: 0,
      stopped: velocity.x === 0 && velocity.y === 0 && velocity.z === 0,
      stepped: false,
      stepHeight: 0,
    };
  }

  if (!trace || !mins || !maxs) {
    throw new Error('applyPmoveFlyMove: doclip=true requires trace/mins/maxs');
  }

  return stepSlideMove({
    origin,
    velocity,
    frametime,
    overbounce,
    trace,
    mins,
    maxs,
    stepSize,
    maxBumps,
    maxClipPlanes,
  });
}

interface FlyFrictionParams {
  readonly velocity: Vec3;
  readonly pmFriction: number;
  readonly pmStopSpeed: number;
  readonly frametime: number;
}

function applyFlyFriction(params: FlyFrictionParams): Vec3 {
  const { velocity, pmFriction, pmStopSpeed, frametime } = params;
  const speed = lengthVec3(velocity);

  if (speed < 1) {
    return { x: 0, y: 0, z: 0 };
  }

  const friction = pmFriction * FLY_FRICTION_MULTIPLIER;
  const control = speed < pmStopSpeed ? pmStopSpeed : speed;
  const drop = control * friction * frametime;

  let newspeed = speed - drop;
  if (newspeed < 0) {
    newspeed = 0;
  }

  if (newspeed === speed) {
    return velocity;
  }

  return scaleVec3(velocity, newspeed / speed);
}

interface FlyWishVelocityParams {
  readonly cmd: PmoveCmd;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly pmMaxSpeed: number;
  readonly pmWaterSpeed: number;
}

interface FlyWishVelocityResult {
  readonly wishdir: Vec3;
  readonly wishspeed: number;
  readonly accelSpeed: number;
}

function buildFlyWishVelocity(params: FlyWishVelocityParams): FlyWishVelocityResult {
  const { cmd, forward, right, pmMaxSpeed, pmWaterSpeed } = params;

  const forwardNorm = normalizeVec3(forward);
  const rightNorm = normalizeVec3(right);

  const wishvel = {
    x: forwardNorm.x * cmd.forwardmove + rightNorm.x * cmd.sidemove,
    y: forwardNorm.y * cmd.forwardmove + rightNorm.y * cmd.sidemove,
    z: forwardNorm.z * cmd.forwardmove + rightNorm.z * cmd.sidemove,
  } satisfies Vec3;

  let adjusted = wishvel;
  const buttons = cmd.buttons ?? 0;

  if (buttons & PlayerButton.Jump) {
    adjusted = addVec3(adjusted, { x: 0, y: 0, z: pmWaterSpeed * BUTTON_VERTICAL_SCALE });
  }

  if (buttons & PlayerButton.Crouch) {
    adjusted = addVec3(adjusted, { x: 0, y: 0, z: -pmWaterSpeed * BUTTON_VERTICAL_SCALE });
  }

  let wishspeed = lengthVec3(adjusted);
  let wishdir = wishspeed === 0 ? { x: 0, y: 0, z: 0 } : normalizeVec3(adjusted);

  if (wishspeed > pmMaxSpeed) {
    const scale = pmMaxSpeed / wishspeed;
    adjusted = scaleVec3(adjusted, scale);
    wishspeed = pmMaxSpeed;
    wishdir = wishspeed === 0 ? { x: 0, y: 0, z: 0 } : normalizeVec3(adjusted);
  }

  const accelSpeed = wishspeed * 2;

  return { wishdir, wishspeed, accelSpeed };
}
