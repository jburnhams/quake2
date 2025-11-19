import { addVec3, ZERO_VEC3, clipVelocityVec3, crossVec3, dotVec3, scaleVec3, type Vec3 } from '../math/vec3.js';
import type { PmoveTraceFn } from './types.js';

const DEFAULT_MAX_CLIP_PLANES = 5;
const DEFAULT_MAX_BUMPS = 4;

export const SLIDEMOVE_BLOCKED_FLOOR = 1;
export const SLIDEMOVE_BLOCKED_WALL = 2;

export interface SlideMoveResult {
  readonly velocity: Vec3;
  readonly planes: readonly Vec3[];
  readonly stopped: boolean;
}

export interface SlideMoveParams {
  readonly origin: Vec3;
  readonly velocity: Vec3;
  readonly frametime: number;
  readonly overbounce: number;
  readonly trace: PmoveTraceFn;
  readonly maxBumps?: number;
  readonly maxClipPlanes?: number;
}

export interface SlideMoveOutcome extends SlideMoveResult {
  readonly origin: Vec3;
  readonly blocked: number;
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
  initialVelocity: Vec3,
  planesEncountered: readonly Vec3[],
  overbounce: number,
  maxClipPlanes = DEFAULT_MAX_CLIP_PLANES,
  primalVelocity: Vec3 = initialVelocity,
): SlideMoveResult {
  if (planesEncountered.length === 0) {
    return { velocity: initialVelocity, planes: [], stopped: false };
  }

  const planes: Vec3[] = [];
  let velocity: Vec3 = initialVelocity;

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

/**
 * Pure mirror of PM_SlideMoveGeneric from rerelease `p_move.cpp` (minus gravity/step handling).
 * Uses a caller-provided trace to collect collision planes, accumulates them through
 * `resolveSlideMove`, and returns the resulting origin/velocity/blocking state.
 */
export function slideMove(params: SlideMoveParams): SlideMoveOutcome {
  const {
    origin: initialOrigin,
    velocity: initialVelocity,
    frametime,
    overbounce,
    trace,
    maxBumps = DEFAULT_MAX_BUMPS,
    maxClipPlanes = DEFAULT_MAX_CLIP_PLANES,
  } = params;

  let origin = initialOrigin;
  let velocity = initialVelocity;
  const planes: Vec3[] = [];
  const primalVelocity = initialVelocity;
  let timeLeft = frametime;
  let blocked = 0;

  for (let bump = 0; bump < maxBumps; bump++) {
    if (velocity.x === 0 && velocity.y === 0 && velocity.z === 0) {
      break;
    }

    const end = addVec3(origin, scaleVec3(velocity, timeLeft));
    const tr = trace(origin, end);

    if (tr.allsolid) {
      return { origin: tr.endpos, velocity: ZERO_VEC3, planes, stopped: true, blocked };
    }

    if (tr.fraction > 0) {
      origin = tr.endpos;
    }

    if (tr.fraction === 1) {
      break;
    }

    if (!tr.planeNormal) {
      return { origin, velocity: ZERO_VEC3, planes, stopped: true, blocked };
    }

    if (tr.planeNormal.z > 0.7) {
      blocked |= SLIDEMOVE_BLOCKED_FLOOR;
    }
    if (tr.planeNormal.z === 0) {
      blocked |= SLIDEMOVE_BLOCKED_WALL;
    }

    planes.push(tr.planeNormal);
    timeLeft -= timeLeft * tr.fraction;

    const resolved = resolveSlideMove(velocity, planes, overbounce, maxClipPlanes, primalVelocity);
    velocity = resolved.velocity;
    planes.splice(0, planes.length, ...resolved.planes);

    if (resolved.stopped) {
      return { origin, velocity, planes, stopped: true, blocked };
    }
  }

  return { origin, velocity, planes, stopped: velocity.x === 0 && velocity.y === 0 && velocity.z === 0, blocked };
}
