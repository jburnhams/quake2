import type { Vec3 } from '../math/vec3.js';
import { addVec3, lengthVec3, normalizeVec3, scaleVec3 } from '../math/vec3.js';
import { applyPmoveAccelerate, applyPmoveAirAccelerate } from './pmove.js';
import { applyPmoveAddCurrents } from './currents.js';
import { stepSlideMove, type StepSlideMoveOutcome } from './slide.js';
import type { PmoveCmd, PmoveTraceFn } from './types.js';
import {
  PmFlag,
  type PmFlags,
  PmType,
  PlayerButton,
  WaterLevel,
  hasPmFlag,
} from './constants.js';

interface BaseMoveParams {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly frametime: number;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace: PmoveTraceFn;
  readonly overbounce?: number;
  readonly stepSize?: number;
  readonly maxBumps?: number;
  readonly maxClipPlanes?: number;
  readonly hasTime?: boolean;
}

export interface AirMoveParams extends BaseMoveParams {
  readonly cmd: PmoveCmd;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly pmFlags: PmFlags;
  readonly onGround: boolean;
  readonly gravity: number;
  readonly pmType: PmType;
  readonly pmAccelerate: number;
  readonly pmAirAccelerate?: number;
  readonly pmMaxSpeed: number;
  readonly pmDuckSpeed: number;
  readonly onLadder: boolean;
  readonly waterlevel: WaterLevel;
  readonly watertype: number;
  readonly groundContents: number;
  readonly viewPitch: number;
  readonly ladderMod: number;
  readonly pmWaterSpeed: number;
}

export interface WaterMoveParams extends BaseMoveParams {
  readonly cmd: PmoveCmd;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly pmFlags: PmFlags;
  readonly onGround: boolean;
  readonly pmMaxSpeed: number;
  readonly pmDuckSpeed: number;
  readonly pmWaterAccelerate: number;
  readonly pmWaterSpeed: number;
  readonly onLadder: boolean;
  readonly watertype: number;
  readonly groundContents: number;
  readonly waterlevel: WaterLevel;
  readonly viewPitch: number;
  readonly ladderMod: number;
}

const DEFAULT_AIR_ACCELERATE = 1;
const WATER_DRIFT_SPEED = 60;

export function applyPmoveAirMove(params: AirMoveParams): StepSlideMoveOutcome {
  const {
    origin,
    frametime,
    mins,
    maxs,
    trace,
    overbounce,
    stepSize,
    maxBumps,
    maxClipPlanes,
    hasTime,
    forward,
    right,
    cmd,
    pmFlags,
    onGround,
    gravity,
    pmType,
    pmAccelerate,
    pmAirAccelerate = DEFAULT_AIR_ACCELERATE,
    pmMaxSpeed,
    pmDuckSpeed,
    onLadder,
    waterlevel,
    watertype,
    groundContents,
    viewPitch,
    ladderMod,
    pmWaterSpeed,
  } = params;

  let velocity = { ...params.velocity };
  let wishvel = buildPlanarWishVelocity(forward, right, cmd);

  wishvel = applyPmoveAddCurrents({
    wishVelocity: wishvel,
    onLadder,
    onGround,
    waterlevel,
    watertype,
    groundContents,
    cmd,
    viewPitch,
    maxSpeed: hasPmFlag(pmFlags, PmFlag.Ducked) ? pmDuckSpeed : pmMaxSpeed,
    ladderMod,
    waterSpeed: pmWaterSpeed,
    forward,
    origin,
    mins,
    maxs,
    trace,
  });

  const ducked = hasPmFlag(pmFlags, PmFlag.Ducked);
  const maxSpeed = ducked ? pmDuckSpeed : pmMaxSpeed;

  let wishdir = wishvel;
  let wishspeed = lengthVec3(wishdir);
  if (wishspeed !== 0) {
    wishdir = normalizeVec3(wishdir);
  }

  if (wishspeed > maxSpeed) {
    const scale = maxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = maxSpeed;
    if (wishspeed !== 0) {
      wishdir = normalizeVec3(wishvel);
    }
  }

  if (onLadder) {
    velocity = applyPmoveAccelerate({ velocity, wishdir, wishspeed, accel: pmAccelerate, frametime });
    if (Math.abs(wishvel.z) < Number.EPSILON) {
      velocity = dampVerticalVelocity(velocity, gravity, frametime);
    }
    return runStepSlideMove({
      origin,
      velocity,
      frametime,
      mins,
      maxs,
      trace,
      overbounce,
      stepSize,
      maxBumps,
      maxClipPlanes,
      hasTime,
    });
  }

  if (onGround) {
    velocity = { ...velocity, z: 0 };
    velocity = applyPmoveAccelerate({ velocity, wishdir, wishspeed, accel: pmAccelerate, frametime });
    if (gravity > 0) {
      velocity = { ...velocity, z: 0 };
    } else {
      velocity = { ...velocity, z: velocity.z - gravity * frametime };
    }

    if (velocity.x === 0 && velocity.y === 0) {
      return {
        origin,
        velocity,
        planes: [],
        blocked: 0,
        stopped: true,
        stepped: false,
        stepHeight: 0,
      };
    }

    return runStepSlideMove({
      origin,
      velocity,
      frametime,
      mins,
      maxs,
      trace,
      overbounce,
      stepSize,
      maxBumps,
      maxClipPlanes,
      hasTime,
    });
  }

  if (pmAirAccelerate > 0) {
    velocity = applyPmoveAirAccelerate({
      velocity,
      wishdir,
      wishspeed,
      accel: pmAirAccelerate,
      frametime,
    });
  } else {
    velocity = applyPmoveAccelerate({ velocity, wishdir, wishspeed, accel: DEFAULT_AIR_ACCELERATE, frametime });
  }

  if (pmType !== PmType.Grapple) {
    velocity = { ...velocity, z: velocity.z - gravity * frametime };
  }

  return runStepSlideMove({
    origin,
    velocity,
    frametime,
    mins,
    maxs,
    trace,
    overbounce,
    stepSize,
    maxBumps,
    maxClipPlanes,
    hasTime,
  });
}

export function applyPmoveWaterMove(params: WaterMoveParams): StepSlideMoveOutcome {
  const {
    origin,
    frametime,
    mins,
    maxs,
    trace,
    overbounce,
    stepSize,
    maxBumps,
    maxClipPlanes,
    hasTime,
    forward,
    right,
    cmd,
    pmFlags,
    onGround,
    pmMaxSpeed,
    pmDuckSpeed,
    pmWaterAccelerate,
    pmWaterSpeed,
    onLadder,
    watertype,
    groundContents,
    waterlevel,
    viewPitch,
    ladderMod,
  } = params;

  let velocity = { ...params.velocity };
  let wishvel = buildFullWishVelocity(forward, right, cmd);

  if (isIdleInWater(cmd, onGround)) {
    wishvel = { ...wishvel, z: wishvel.z - WATER_DRIFT_SPEED };
  } else {
    if (hasButton(cmd, PlayerButton.Crouch)) {
      wishvel = addVec3(wishvel, { x: 0, y: 0, z: -pmWaterSpeed * 0.5 });
    } else if (hasButton(cmd, PlayerButton.Jump)) {
      wishvel = addVec3(wishvel, { x: 0, y: 0, z: pmWaterSpeed * 0.5 });
    }
  }

  wishvel = applyPmoveAddCurrents({
    wishVelocity: wishvel,
    onLadder,
    onGround,
    waterlevel,
    watertype,
    groundContents,
    cmd,
    viewPitch,
    maxSpeed: hasPmFlag(pmFlags, PmFlag.Ducked) ? pmDuckSpeed : pmMaxSpeed,
    ladderMod,
    waterSpeed: pmWaterSpeed,
    forward,
    origin,
    mins,
    maxs,
    trace,
  });

  let wishdir = wishvel;
  let wishspeed = lengthVec3(wishdir);
  if (wishspeed !== 0) {
    wishdir = normalizeVec3(wishdir);
  }

  if (wishspeed > pmMaxSpeed) {
    const scale = pmMaxSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = pmMaxSpeed;
    if (wishspeed !== 0) {
      wishdir = normalizeVec3(wishvel);
    }
  }

  wishspeed *= 0.5;

  const ducked = hasPmFlag(pmFlags, PmFlag.Ducked);
  if (ducked && wishspeed > pmDuckSpeed) {
    const scale = pmDuckSpeed / wishspeed;
    wishvel = scaleVec3(wishvel, scale);
    wishspeed = pmDuckSpeed;
    if (wishspeed !== 0) {
      wishdir = normalizeVec3(wishvel);
    }
  }

  velocity = applyPmoveAccelerate({ velocity, wishdir, wishspeed, accel: pmWaterAccelerate, frametime });

  return runStepSlideMove({
    origin,
    velocity,
    frametime,
    mins,
    maxs,
    trace,
    overbounce,
    stepSize,
    maxBumps,
    maxClipPlanes,
    hasTime,
  });
}

function buildPlanarWishVelocity(forward: Vec3, right: Vec3, cmd: PmoveCmd): Vec3 {
  return {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: 0,
  } satisfies Vec3;
}

function buildFullWishVelocity(forward: Vec3, right: Vec3, cmd: PmoveCmd): Vec3 {
  return {
    x: forward.x * cmd.forwardmove + right.x * cmd.sidemove,
    y: forward.y * cmd.forwardmove + right.y * cmd.sidemove,
    z: forward.z * cmd.forwardmove + right.z * cmd.sidemove,
  } satisfies Vec3;
}

function hasButton(cmd: PmoveCmd, button: PlayerButton): boolean {
  return (cmd.buttons ?? 0) & button ? true : false;
}

function isIdleInWater(cmd: PmoveCmd, onGround: boolean): boolean {
  const noMove = cmd.forwardmove === 0 && cmd.sidemove === 0;
  const noButtons = (cmd.buttons ?? 0) & (PlayerButton.Jump | PlayerButton.Crouch) ? false : true;
  return noMove && noButtons && !onGround;
}

function dampVerticalVelocity(velocity: Vec3, gravity: number, frametime: number): Vec3 {
  let z = velocity.z;
  const delta = gravity * frametime;
  if (z > 0) {
    z -= delta;
    if (z < 0) {
      z = 0;
    }
  } else {
    z += delta;
    if (z > 0) {
      z = 0;
    }
  }
  return { ...velocity, z };
}

interface StepParams extends BaseMoveParams {
  readonly velocity: Vec3;
}

function runStepSlideMove(params: StepParams): StepSlideMoveOutcome {
  const { origin, velocity, frametime, mins, maxs, trace, overbounce, stepSize, maxBumps, maxClipPlanes, hasTime } = params;
  return stepSlideMove({
    origin,
    velocity,
    frametime,
    trace,
    mins,
    maxs,
    overbounce,
    stepSize,
    maxBumps,
    maxClipPlanes,
    hasTime,
  });
}
