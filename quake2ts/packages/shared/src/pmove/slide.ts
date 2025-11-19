import { addVec3, ZERO_VEC3, clipVelocityVec3, crossVec3, dotVec3, scaleVec3, type Vec3 } from '../math/vec3.js';
import type { PmoveTraceFn } from './types.js';

const DEFAULT_MAX_CLIP_PLANES = 5;
const DEFAULT_MAX_BUMPS = 4;
const DEFAULT_STEP_SIZE = 18;
const MIN_STEP_NORMAL = 0.7;

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
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
  /**
   * Mirrors the pm->s.pm_time check in PM_StepSlideMove_Generic: if true, the
   * returned velocity is reset to the primal velocity after collision
   * resolution so time-based effects (like knockbacks) don't dampen.
   */
  readonly hasTime?: boolean;
}

export interface SlideMoveOutcome extends SlideMoveResult {
  readonly origin: Vec3;
  readonly blocked: number;
}

export interface StepSlideMoveParams extends SlideMoveParams {
  readonly mins: Vec3;
  readonly maxs: Vec3;
  readonly stepSize?: number;
}

export interface StepSlideMoveOutcome extends SlideMoveOutcome {
  readonly stepped: boolean;
  readonly stepHeight: number;
  readonly stepNormal?: Vec3;
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
    mins,
    maxs,
    hasTime = false,
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
    const tr = trace(origin, end, mins, maxs);

    if (tr.allsolid) {
      const velocity = hasTime ? primalVelocity : ZERO_VEC3;
      return { origin: tr.endpos, velocity, planes, stopped: true, blocked };
    }

    if (tr.startsolid) {
      const velocity = hasTime ? primalVelocity : ZERO_VEC3;
      return { origin: tr.endpos, velocity, planes, stopped: true, blocked };
    }

    if (tr.fraction > 0) {
      origin = tr.endpos;
    }

    if (tr.fraction === 1) {
      break;
    }

    if (!tr.planeNormal) {
      const velocity = hasTime ? primalVelocity : ZERO_VEC3;
      return { origin, velocity, planes, stopped: true, blocked };
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

    if (primalVelocity.z > 0 && velocity.z < 0) {
      velocity = { ...velocity, z: 0 };
    }

    if (resolved.stopped) {
      const velocityOut = hasTime ? primalVelocity : velocity;
      return { origin, velocity: velocityOut, planes, stopped: true, blocked };
    }
  }

  const velocityOut = hasTime ? primalVelocity : velocity;
  return { origin, velocity: velocityOut, planes, stopped: velocityOut.x === 0 && velocityOut.y === 0 && velocityOut.z === 0, blocked };
}

/**
 * Mirrors PM_StepSlideMove (rerelease p_move.cpp) in a pure form: attempts a
 * regular slide move, then retries from a stepped-up position when the first
 * attempt was blocked. The function compares planar distance traveled and the
 * steepness of the landing plane to decide whether to keep the step.
 */
export function stepSlideMove(params: StepSlideMoveParams): StepSlideMoveOutcome {
  const { mins, maxs, stepSize = DEFAULT_STEP_SIZE, ...rest } = params;

  const startOrigin = params.origin;
  const startVelocity = params.velocity;

  const downResult = slideMove({ ...rest, mins, maxs });

  const upTarget = addVec3(startOrigin, { x: 0, y: 0, z: stepSize });
  const upTrace = rest.trace(startOrigin, upTarget, mins, maxs);
  if (upTrace.allsolid) {
    return { ...downResult, stepped: false, stepHeight: 0 };
  }

  const actualStep = upTrace.endpos.z - startOrigin.z;
  const steppedResult = slideMove({ ...rest, origin: upTrace.endpos, velocity: startVelocity, mins, maxs });

  const pushDownTarget = addVec3(steppedResult.origin, { x: 0, y: 0, z: -actualStep });
  const downTrace = rest.trace(steppedResult.origin, pushDownTarget, mins, maxs);

  let steppedOrigin = steppedResult.origin;
  let stepNormal = downTrace.planeNormal;

  if (!downTrace.allsolid) {
    steppedOrigin = downTrace.endpos;
  }

  const planarDistanceSquared = (a: Vec3, b: Vec3) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  const downDist = planarDistanceSquared(downResult.origin, startOrigin);
  const upDist = planarDistanceSquared(steppedOrigin, startOrigin);

  if (downDist > upDist || (stepNormal && stepNormal.z < MIN_STEP_NORMAL)) {
    return { ...downResult, stepped: false, stepHeight: 0 };
  }

  const steppedVelocity = { ...steppedResult.velocity, z: downResult.velocity.z };
  const steppedBlocked = steppedResult.blocked;
  const stopped = steppedVelocity.x === 0 && steppedVelocity.y === 0 && steppedVelocity.z === 0;

  return {
    origin: steppedOrigin,
    velocity: steppedVelocity,
    planes: steppedResult.planes,
    blocked: steppedBlocked,
    stopped,
    stepped: true,
    stepHeight: actualStep,
    stepNormal,
  };
}
