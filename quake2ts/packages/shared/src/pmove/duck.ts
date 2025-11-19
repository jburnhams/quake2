import { MASK_SOLID, MASK_WATER, type ContentsFlag } from '../bsp/contents.js';
import type { Vec3 } from '../math/vec3.js';
import {
  PlayerButton,
  PmFlag,
  type PmFlags,
  PmType,
  WaterLevel,
  addPmFlag,
  hasPmFlag,
  removePmFlag,
} from './constants.js';
import type { PmoveTraceResult } from './types.js';
import { computePlayerDimensions, type PlayerDimensions } from './dimensions.js';

const CROUCH_MAX_Z = 4;
const STAND_MAX_Z = 32;
const ABOVE_WATER_OFFSET = 8;

export interface DuckTraceParams {
  readonly start: Vec3;
  readonly end: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly mask: ContentsFlag;
}

export type DuckTraceFn = (params: DuckTraceParams) => PmoveTraceResult;

export interface CheckDuckParams {
  readonly pmType: PmType;
  readonly pmFlags: PmFlags;
  readonly buttons: number;
  readonly waterlevel: WaterLevel;
  readonly hasGroundEntity: boolean;
  readonly onLadder: boolean;
  readonly n64Physics: boolean;
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace: DuckTraceFn;
}

export interface CheckDuckResult extends PlayerDimensions {
  readonly pmFlags: PmFlags;
  readonly ducked: boolean;
  readonly changed: boolean;
}

/**
 * Pure port of PM_CheckDuck from rerelease `p_move.cpp`. Updates the PMF_DUCKED flag
 * based on crouch input, obstruction traces, and special cases (dead bodies) without
 * mutating the provided mins/maxs. Returns the updated flag word plus the dimensions
 * computed from PM_SetDimensions so callers can update collision bounds atomically.
 */
export function checkDuckState(params: CheckDuckParams): CheckDuckResult {
  const { pmType } = params;

  if (pmType === PmType.Gib) {
    const dims = computePlayerDimensions(pmType, params.pmFlags);
    return { pmFlags: params.pmFlags, ducked: hasPmFlag(params.pmFlags, PmFlag.Ducked), changed: false, ...dims };
  }

  let flags = params.pmFlags;
  let changed = false;

  if (pmType === PmType.Dead) {
    if (!hasPmFlag(flags, PmFlag.Ducked)) {
      flags = addPmFlag(flags, PmFlag.Ducked);
      changed = true;
    }
  } else if (shouldDuck(params)) {
    if (!hasPmFlag(flags, PmFlag.Ducked) && !isDuckBlocked(params)) {
      flags = addPmFlag(flags, PmFlag.Ducked);
      changed = true;
    }
  } else if (hasPmFlag(flags, PmFlag.Ducked) && !isStandBlocked(params)) {
    flags = removePmFlag(flags, PmFlag.Ducked);
    changed = true;
  }

  const dims = computePlayerDimensions(pmType, flags);
  const ducked = pmType === PmType.Dead || hasPmFlag(flags, PmFlag.Ducked);

  return { pmFlags: flags, ducked, changed, ...dims };
}

function shouldDuck(params: CheckDuckParams): boolean {
  if ((params.buttons & PlayerButton.Crouch) === 0) {
    return false;
  }
  if (params.onLadder || params.n64Physics) {
    return false;
  }
  if (params.hasGroundEntity) {
    return true;
  }
  if (params.waterlevel <= WaterLevel.Feet && !isAboveWater(params)) {
    return true;
  }
  return false;
}

function isDuckBlocked(params: CheckDuckParams): boolean {
  const trace = params.trace({
    start: params.origin,
    end: params.origin,
    mins: params.mins,
    maxs: withZ(params.maxs, CROUCH_MAX_Z),
    mask: MASK_SOLID,
  });
  return trace.allsolid;
}

function isStandBlocked(params: CheckDuckParams): boolean {
  const trace = params.trace({
    start: params.origin,
    end: params.origin,
    mins: params.mins,
    maxs: withZ(params.maxs, STAND_MAX_Z),
    mask: MASK_SOLID,
  });
  return trace.allsolid;
}

function isAboveWater(params: CheckDuckParams): boolean {
  const below: Vec3 = { x: params.origin.x, y: params.origin.y, z: params.origin.z - ABOVE_WATER_OFFSET };

  const solidTrace = params.trace({
    start: params.origin,
    end: below,
    mins: params.mins,
    maxs: params.maxs,
    mask: MASK_SOLID,
  });

  if (solidTrace.fraction < 1) {
    return false;
  }

  const waterTrace = params.trace({
    start: params.origin,
    end: below,
    mins: params.mins,
    maxs: params.maxs,
    mask: MASK_WATER,
  });

  return waterTrace.fraction < 1;
}

function withZ(vec: Vec3, z: number): Vec3 {
  return { x: vec.x, y: vec.y, z };
}
