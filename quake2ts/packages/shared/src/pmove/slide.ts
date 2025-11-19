import { ZERO_VEC3, clipVelocityVec3, crossVec3, dotVec3, scaleVec3, type Vec3 } from '../math/vec3.js';

const DEFAULT_MAX_CLIP_PLANES = 5;

export interface SlideMoveResult {
  readonly velocity: Vec3;
  readonly planes: readonly Vec3[];
  readonly stopped: boolean;
}

/**
 * Resolves a sequence of collision planes against a primal velocity using the same
 * plane iteration logic seen in PM_StepSlideMove_Generic (rerelease p_move.cpp).
 * The incoming planes should be ordered as they were encountered during traces;
 * the function will accumulate them, clip the velocity to be parallel to all planes,
 * and return zero velocity when three planes form an unresolvable corner or when
 * the adjusted velocity would oppose the primal direction.
 */
export function resolveSlideMove(
  primalVelocity: Vec3,
  planesEncountered: readonly Vec3[],
  overbounce: number,
  maxClipPlanes = DEFAULT_MAX_CLIP_PLANES,
): SlideMoveResult {
  if (planesEncountered.length === 0) {
    return { velocity: primalVelocity, planes: [], stopped: false };
  }

  const planes: Vec3[] = [];
  let velocity: Vec3 = primalVelocity;

  for (const plane of planesEncountered) {
    if (planes.length >= maxClipPlanes) {
      return { velocity: ZERO_VEC3, planes, stopped: true };
    }

    // Skip near-duplicate planes to mirror the epsilon guard in PM_StepSlideMove_Generic.
    const duplicate = planes.find((existing) => dotVec3(existing, plane) > 0.99);
    if (duplicate) {
      continue;
    }

    planes.push(plane);

    let clipped: Vec3 | undefined;
    let i = 0;
    for (; i < planes.length; i++) {
      const candidate = clipVelocityVec3(velocity, planes[i], overbounce);

      let j = 0;
      for (; j < planes.length; j++) {
        if (j === i) continue;
        if (dotVec3(candidate, planes[j]) < 0) break;
      }

      if (j === planes.length) {
        clipped = candidate;
        break;
      }
    }

    if (clipped) {
      velocity = clipped;
    } else {
      if (planes.length !== 2) {
        return { velocity: ZERO_VEC3, planes, stopped: true };
      }

      const dir = crossVec3(planes[0], planes[1]);
      const d = dotVec3(dir, velocity);
      velocity = scaleVec3(dir, d);
    }

    // If velocity reversed relative to the primal direction, stop to avoid oscillations.
    if (dotVec3(velocity, primalVelocity) <= 0) {
      return { velocity: ZERO_VEC3, planes, stopped: true };
    }
  }

  const stopped = velocity.x === 0 && velocity.y === 0 && velocity.z === 0;
  return { velocity, planes, stopped };
}
