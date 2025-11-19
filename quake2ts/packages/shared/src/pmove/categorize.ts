import { CONTENTS_NONE, type ContentsFlag } from '../bsp/contents.js';
import { addVec3, clipVelocityVec3, type Vec3 } from '../math/vec3.js';
import {
  PmFlag,
  type PmFlags,
  PmType,
  addPmFlag,
  hasPmFlag,
  removePmFlag,
} from './constants.js';
import { getWaterLevel } from './water.js';
import type { PmovePointContentsFn, PmoveTraceFn, PmoveTraceResult } from './types.js';

const GROUND_PROBE_DISTANCE = 0.25;
const LADDER_BYPASS_VELOCITY = 180;
const TRICK_VELOCITY_THRESHOLD = 100;
const SLANTED_NORMAL_THRESHOLD = 0.7;
const TRICK_NORMAL_THRESHOLD = 0.9;
const TRICK_PM_TIME = 64;
const LAND_PM_TIME = 128;
const IMPACT_CLIP_OVERBOUNCE = 1.01;

const WATERJUMP_CLEAR =
  PmFlag.TimeWaterJump | PmFlag.TimeLand | PmFlag.TimeTeleport | PmFlag.TimeTrick;

export interface CategorizePositionParams {
  readonly pmType: PmType;
  readonly pmFlags: PmFlags;
  readonly pmTime: number;
  readonly n64Physics: boolean;
  readonly velocity: Vec3;
  readonly startVelocity: Vec3;
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly viewheight: number;
  readonly trace: PmoveTraceFn;
  readonly pointContents: PmovePointContentsFn;
}

export interface CategorizePositionResult {
  readonly pmFlags: PmFlags;
  readonly pmTime: number;
  readonly onGround: boolean;
  readonly groundTrace?: PmoveTraceResult;
  readonly groundContents: ContentsFlag;
  readonly waterlevel: number;
  readonly watertype: ContentsFlag;
  readonly impactDelta?: number;
}

/**
 * Pure mirror of PM_CatagorizePosition from `rerelease/p_move.cpp`: traces a quarter-unit
 * below the player bounds to determine whether they stand on solid ground, updates timers
 * and pmflags accordingly, records the latest ground plane data, and recalculates waterlevel
 * by probing feet/waist/viewheight samples.
 */
export function categorizePosition(params: CategorizePositionParams): CategorizePositionResult {
  const {
    pmType,
    n64Physics,
    velocity,
    startVelocity,
    origin,
    mins,
    maxs,
    viewheight,
    trace,
    pointContents,
  } = params;

  let pmFlags = params.pmFlags;
  let pmTime = params.pmTime;
  let impactDelta: number | undefined;
  let onGround = hasPmFlag(pmFlags, PmFlag.OnGround);

  let groundTrace: PmoveTraceResult | undefined;
  let groundContents: ContentsFlag = CONTENTS_NONE;

  const forceAirborne = velocity.z > LADDER_BYPASS_VELOCITY || pmType === PmType.Grapple;

  if (forceAirborne) {
    pmFlags = removePmFlag(pmFlags, PmFlag.OnGround);
    onGround = false;
  } else {
    const end: Vec3 = { x: origin.x, y: origin.y, z: origin.z - GROUND_PROBE_DISTANCE };
    const traceResult = trace(origin, end, mins, maxs);
    groundTrace = traceResult;
    groundContents = traceResult.contents ?? CONTENTS_NONE;

    const planeNormal = traceResult.planeNormal;

    let slantedGround =
      traceResult.fraction < 1 && !!planeNormal && planeNormal.z < SLANTED_NORMAL_THRESHOLD;

    if (slantedGround && planeNormal) {
      const slantEnd = addVec3(origin, planeNormal);
      const slantTrace = trace(origin, slantEnd, mins, maxs);
      if (slantTrace.fraction < 1 && !slantTrace.startsolid) {
        slantedGround = false;
      }
    }

    if (
      traceResult.fraction === 1 ||
      !planeNormal ||
      (slantedGround && !traceResult.startsolid)
    ) {
      pmFlags = removePmFlag(pmFlags, PmFlag.OnGround);
      onGround = false;
    } else {
      onGround = true;

      if (hasPmFlag(pmFlags, PmFlag.TimeWaterJump)) {
        pmFlags &= ~WATERJUMP_CLEAR;
        pmTime = 0;
      }

      const wasOnGround = hasPmFlag(pmFlags, PmFlag.OnGround);

      if (!wasOnGround) {
        if (
          !n64Physics &&
          velocity.z >= TRICK_VELOCITY_THRESHOLD &&
          planeNormal.z >= TRICK_NORMAL_THRESHOLD &&
          !hasPmFlag(pmFlags, PmFlag.Ducked)
        ) {
          pmFlags = addPmFlag(pmFlags, PmFlag.TimeTrick);
          pmTime = TRICK_PM_TIME;
        }

        const clipped = clipVelocityVec3(velocity, planeNormal, IMPACT_CLIP_OVERBOUNCE);
        impactDelta = startVelocity.z - clipped.z;
      }

      pmFlags = addPmFlag(pmFlags, PmFlag.OnGround);

      if (!wasOnGround && (n64Physics || hasPmFlag(pmFlags, PmFlag.Ducked))) {
        pmFlags = addPmFlag(pmFlags, PmFlag.TimeLand);
        pmTime = LAND_PM_TIME;
      }
    }
  }

  const { waterlevel, watertype } = getWaterLevel({
    origin,
    mins,
    viewheight,
    pointContents,
  });

  return {
    pmFlags,
    pmTime,
    onGround: hasPmFlag(pmFlags, PmFlag.OnGround),
    groundTrace,
    groundContents,
    waterlevel,
    watertype,
    impactDelta,
  };
}
