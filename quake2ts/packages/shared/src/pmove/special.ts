import { CONTENTS_LADDER, CONTENTS_NONE, CONTENTS_NO_WATERJUMP } from '../bsp/contents.js';
import { addVec3, lengthSquaredVec3, normalizeVec3, scaleVec3, type Vec3 } from '../math/vec3.js';
import { PlayerButton, PmFlag, type PmFlags, addPmFlag, removePmFlag, WaterLevel } from './constants.js';
import { stepSlideMove } from './slide.js';
import type { PmoveCmd, PmovePointContentsFn, PmoveTraceFn } from './types.js';
import { getWaterLevel } from './water.js';

const LADDER_TRACE_DISTANCE = 1;
const WATERJUMP_FORWARD_CHECK = 40;
const WATERJUMP_FORWARD_SPEED = 50;
const WATERJUMP_UPWARD_SPEED = 350;
const WATERJUMP_PM_TIME = 2048;
const WATERJUMP_SIM_STEP = 0.1;
const WATERJUMP_BASE_GRAVITY = 800;
const WATERJUMP_MAX_STEPS = 50;
const GROUND_NORMAL_THRESHOLD = 0.7;
const WATERJUMP_STEP_TOLERANCE = 18;
const DEFAULT_OVERBOUNCE = 1.01;
const WATERJUMP_DOWN_PROBE = 2;

export interface SpecialMovementParams {
  readonly pmFlags: PmFlags;
  readonly pmTime: number;
  readonly waterlevel: WaterLevel;
  readonly watertype: number;
  readonly gravity: number;
  readonly cmd: PmoveCmd;
  readonly forward: Vec3;
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly viewheight: number;
  readonly trace: PmoveTraceFn;
  readonly pointContents: PmovePointContentsFn;
  readonly onGround: boolean;
  readonly overbounce?: number;
  readonly stepSize?: number;
  readonly maxBumps?: number;
  readonly maxClipPlanes?: number;
}

export interface SpecialMovementResult {
  readonly pmFlags: PmFlags;
  readonly pmTime: number;
  readonly velocity: Vec3;
  readonly performedWaterJump: boolean;
}

/**
 * Mirrors the ladder detection and water-jump probing logic from
 * `PM_CheckSpecialMovement` in `rerelease/p_move.cpp`. The helper clears and
 * re-adds the ladder flag based on nearby CONTENTS_LADDER brushes, then
 * simulates a potential water jump by firing the same 40-unit probe and
 * step-slide loop the C++ uses before committing to the upward velocity.
 */
export function checkSpecialMovement(params: SpecialMovementParams): SpecialMovementResult {
  const {
    pmFlags: initialFlags,
    pmTime: initialPmTime,
    waterlevel,
    watertype,
    gravity,
    cmd,
    forward,
    origin,
    velocity: initialVelocity,
    mins,
    maxs,
    viewheight,
    trace,
    pointContents,
    onGround,
    overbounce = DEFAULT_OVERBOUNCE,
    stepSize = WATERJUMP_STEP_TOLERANCE,
    maxBumps,
    maxClipPlanes,
  } = params;

  if (initialPmTime > 0) {
    return { pmFlags: initialFlags, pmTime: initialPmTime, velocity: initialVelocity, performedWaterJump: false };
  }

  let pmFlags = removePmFlag(initialFlags, PmFlag.OnLadder);
  let pmTime = initialPmTime;
  let velocity = initialVelocity;

  const flatforward = normalizeVec3({ x: forward.x, y: forward.y, z: 0 });
  const hasForward = lengthSquaredVec3(flatforward) > 0;

  if (waterlevel < WaterLevel.Waist && hasForward) {
    const ladderEnd = addVec3(origin, scaleVec3(flatforward, LADDER_TRACE_DISTANCE));
    const ladderTrace = trace(origin, ladderEnd, mins, maxs);
    const contents = ladderTrace.contents ?? CONTENTS_NONE;

    if (ladderTrace.fraction < 1 && (contents & CONTENTS_LADDER) !== 0) {
      pmFlags = addPmFlag(pmFlags, PmFlag.OnLadder);
    }
  }

  if (gravity === 0) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  if (((cmd.buttons ?? 0) & PlayerButton.Jump) === 0 && cmd.forwardmove <= 0) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  if (waterlevel !== WaterLevel.Waist) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  if ((watertype & CONTENTS_NO_WATERJUMP) !== 0) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  if (!hasForward) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  const forwardCheckEnd = addVec3(origin, scaleVec3(flatforward, WATERJUMP_FORWARD_CHECK));
  const forwardTrace = trace(origin, forwardCheckEnd, mins, maxs);

  if (
    forwardTrace.fraction === 1 ||
    !forwardTrace.planeNormal ||
    forwardTrace.planeNormal.z >= GROUND_NORMAL_THRESHOLD
  ) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  let simVelocity: Vec3 = {
    x: flatforward.x * WATERJUMP_FORWARD_SPEED,
    y: flatforward.y * WATERJUMP_FORWARD_SPEED,
    z: WATERJUMP_UPWARD_SPEED,
  };

  let simOrigin = origin;
  let hasTime = true;
  const stepCount = computeWaterJumpSteps(gravity);

  for (let i = 0; i < stepCount; i++) {
    simVelocity.z -= gravity * WATERJUMP_SIM_STEP;
    if (simVelocity.z < 0) {
      hasTime = false;
    }

    const move = stepSlideMove({
      origin: simOrigin,
      velocity: simVelocity,
      frametime: WATERJUMP_SIM_STEP,
      trace,
      mins,
      maxs,
      overbounce,
      stepSize,
      maxBumps,
      maxClipPlanes,
      hasTime,
    });
    simOrigin = move.origin;
    simVelocity = move.velocity;
  }

  const downEnd = addVec3(simOrigin, { x: 0, y: 0, z: -WATERJUMP_DOWN_PROBE });
  const downTrace = trace(simOrigin, downEnd, mins, maxs);

  if (
    downTrace.fraction === 1 ||
    !downTrace.planeNormal ||
    downTrace.planeNormal.z < GROUND_NORMAL_THRESHOLD ||
    downTrace.endpos.z < origin.z
  ) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  if (onGround && Math.abs(origin.z - downTrace.endpos.z) <= stepSize) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  const landingWater = getWaterLevel({ origin: downTrace.endpos, mins, viewheight, pointContents });
  if (landingWater.waterlevel >= WaterLevel.Waist) {
    return { pmFlags, pmTime, velocity, performedWaterJump: false };
  }

  pmFlags = addPmFlag(pmFlags, PmFlag.TimeWaterJump);
  pmTime = WATERJUMP_PM_TIME;
  velocity = {
    x: flatforward.x * WATERJUMP_FORWARD_SPEED,
    y: flatforward.y * WATERJUMP_FORWARD_SPEED,
    z: WATERJUMP_UPWARD_SPEED,
  } satisfies Vec3;

  return { pmFlags, pmTime, velocity, performedWaterJump: true };
}

function computeWaterJumpSteps(gravity: number): number {
  if (gravity === 0) {
    return 0;
  }

  const scaled = Math.floor(10 * (WATERJUMP_BASE_GRAVITY / gravity));
  if (scaled <= 0) {
    return 0;
  }
  return Math.min(WATERJUMP_MAX_STEPS, scaled);
}
