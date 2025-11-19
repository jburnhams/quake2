import type { Vec3 } from '../math/vec3.js';
import { angleVectors, type AngleVectorsResult } from '../math/angles.js';
import { PmFlag, type PmFlags } from './constants.js';

export interface ClampViewAnglesParams {
  readonly pmFlags: PmFlags;
  readonly cmdAngles: Vec3;
  readonly deltaAngles: Vec3;
}

export interface ClampViewAnglesResult extends AngleVectorsResult {
  readonly viewangles: Vec3;
}

function addAngles(cmdAngles: Vec3, deltaAngles: Vec3): Vec3 {
  return {
    x: cmdAngles.x + deltaAngles.x,
    y: cmdAngles.y + deltaAngles.y,
    z: cmdAngles.z + deltaAngles.z,
  } satisfies Vec3;
}

function clampPitch(pitch: number): number {
  if (pitch > 89 && pitch < 180) {
    return 89;
  }
  if (pitch < 271 && pitch >= 180) {
    return 271;
  }
  return pitch;
}

/**
 * Pure translation of `PM_ClampAngles` from `rerelease/p_move.cpp`. The helper
 * fuses the latest command angles with the stored delta, applies the teleport
 * pitch/roll reset, enforces the ±90° pitch window, and returns the resulting
 * axis vectors that the C version stored in `pml.forward/right/up`.
 */
export function clampViewAngles(params: ClampViewAnglesParams): ClampViewAnglesResult {
  const { pmFlags, cmdAngles, deltaAngles } = params;

  let viewangles: Vec3;

  if ((pmFlags & PmFlag.TimeTeleport) !== 0) {
    viewangles = {
      x: 0,
      y: cmdAngles.y + deltaAngles.y,
      z: 0,
    } satisfies Vec3;
  } else {
    viewangles = addAngles(cmdAngles, deltaAngles);
    viewangles = { ...viewangles, x: clampPitch(viewangles.x) };
  }

  const vectors = angleVectors(viewangles);
  return { viewangles, ...vectors };
}
