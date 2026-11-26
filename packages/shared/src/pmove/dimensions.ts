import type { Vec3 } from '../math/vec3.js';
import { PmFlag, type PmFlags, PmType } from './constants.js';

export interface PlayerDimensions {
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly viewheight: number;
}

function createVec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z } satisfies Vec3;
}

/**
 * Pure mirror of PM_SetDimensions from rerelease `p_move.cpp`.
 * Computes the mins/maxs/viewheight triplet for a player based on
 * their movement type and ducked flag without mutating inputs.
 */
export function computePlayerDimensions(pmType: PmType, pmFlags: PmFlags): PlayerDimensions {
  const minsBase = createVec3(-16, -16, 0);
  const maxsBase = createVec3(16, 16, 16);

  if (pmType === PmType.Gib) {
    return {
      mins: minsBase,
      maxs: maxsBase,
      viewheight: 8,
    } satisfies PlayerDimensions;
  }

  const ducked = pmType === PmType.Dead || (pmFlags & PmFlag.Ducked) !== 0;
  const mins = createVec3(minsBase.x, minsBase.y, -24);
  const maxs = createVec3(maxsBase.x, maxsBase.y, ducked ? 4 : 32);

  return {
    mins,
    maxs,
    viewheight: ducked ? -2 : 22,
  } satisfies PlayerDimensions;
}
