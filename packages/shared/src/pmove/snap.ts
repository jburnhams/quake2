import type { Vec3 } from '../math/vec3.js';
import { fixStuckObjectGeneric } from './stuck.js';
import type { PmoveTraceFn } from './types.js';

const SNAP_OFFSETS = [0, -1, 1] as const;

export interface GoodPositionParams {
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly trace: PmoveTraceFn;
}

export function goodPosition(params: GoodPositionParams): boolean {
  const { origin, mins, maxs, trace } = params;
  const result = trace(origin, origin, mins, maxs);
  return result.allsolid ? false : true;
}

export type SnapResolution = 'unchanged' | 'fixed' | 'reverted';

export interface SnapPositionParams extends GoodPositionParams {
  readonly velocity: Vec3;
  readonly previousOrigin: Vec3;
}

export interface SnapPositionResult {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly resolution: SnapResolution;
}

/**
 * Pure translation of PM_SnapPosition from rerelease `p_move.cpp`.
 * Attempts to keep the caller's origin in a valid location by first
 * checking the current origin against collision traces, then falling
 * back to the shared `fixStuckObjectGeneric` helper before finally
 * reverting to the provided previous origin when no fix is possible.
 */
export function snapPosition(params: SnapPositionParams): SnapPositionResult {
  const { origin, velocity, mins, maxs, previousOrigin, trace } = params;

  if (goodPosition({ origin, mins, maxs, trace })) {
    return { origin: { ...origin }, velocity: { ...velocity }, resolution: 'unchanged' };
  }

  const fix = fixStuckObjectGeneric({
    origin,
    mins,
    maxs,
    trace: (start, localMins, localMaxs, end) => trace(start, end, localMins, localMaxs),
  });

  if (fix.result === 'fixed' || fix.result === 'good-position') {
    return { origin: fix.origin, velocity: { ...velocity }, resolution: 'fixed' };
  }

  return { origin: { ...previousOrigin }, velocity: { ...velocity }, resolution: 'reverted' };
}

export interface InitialSnapPositionParams extends GoodPositionParams {}

export interface InitialSnapPositionResult {
  readonly origin: Vec3;
  readonly snapped: boolean;
}

/**
 * Pure translation of PM_InitialSnapPosition from rerelease `p_move.cpp`.
 * Tries a 3x3x3 grid of +/-1 unit offsets around the base origin to find
 * a valid collision-free spot, mirroring the search order of the C++ code.
 */
export function initialSnapPosition(params: InitialSnapPositionParams): InitialSnapPositionResult {
  const { origin, mins, maxs, trace } = params;

  for (const oz of SNAP_OFFSETS) {
    for (const oy of SNAP_OFFSETS) {
      for (const ox of SNAP_OFFSETS) {
        const candidate = { x: origin.x + ox, y: origin.y + oy, z: origin.z + oz } satisfies Vec3;
        if (goodPosition({ origin: candidate, mins, maxs, trace })) {
          const snapped = ox !== 0 || oy !== 0 || oz !== 0;
          return { origin: candidate, snapped };
        }
      }
    }
  }

  return { origin: { ...origin }, snapped: false };
}
