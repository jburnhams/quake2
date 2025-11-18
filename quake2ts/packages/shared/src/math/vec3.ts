export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly [index: number]: number;
}

export const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

// Matches STOP_EPSILON from rerelease q_vec3.h
export const STOP_EPSILON = 0.1;

export function addVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtractVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function multiplyVec3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

export function scaleVec3(a: Vec3, scalar: number): Vec3 {
  return { x: a.x * scalar, y: a.y * scalar, z: a.z * scalar };
}

export function negateVec3(a: Vec3): Vec3 {
  return scaleVec3(a, -1);
}

export function dotVec3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function crossVec3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function lengthSquaredVec3(a: Vec3): number {
  return dotVec3(a, a);
}

export function lengthVec3(a: Vec3): number {
  return Math.sqrt(lengthSquaredVec3(a));
}

/**
 * Returns the normalized vector. If the vector is zero-length, the
 * input is returned to mirror the rerelease q_vec3 semantics.
 */
export function normalizeVec3(a: Vec3): Vec3 {
  const len = lengthVec3(a);
  return len === 0 ? a : scaleVec3(a, 1 / len);
}

/**
 * Projects a point onto a plane defined by the given normal.
 * Based on ProjectPointOnPlane in the rerelease q_vec3 helpers.
 */
export function projectPointOnPlane(point: Vec3, normal: Vec3): Vec3 {
  const invDenom = 1 / dotVec3(normal, normal);
  const d = dotVec3(normal, point) * invDenom;
  return subtractVec3(point, scaleVec3(scaleVec3(normal, invDenom), d));
}

/**
 * Computes a perpendicular vector to the provided direction using the
 * smallest axial component heuristic used by the rerelease.
 * Assumes the input is normalized.
 */
export function perpendicularVec3(src: Vec3): Vec3 {
  let pos = 0;
  let minElement = Math.abs(src.x);

  if (Math.abs(src.y) < minElement) {
    pos = 1;
    minElement = Math.abs(src.y);
  }

  if (Math.abs(src.z) < minElement) {
    pos = 2;
  }

  const axis = pos === 0 ? { x: 1, y: 0, z: 0 } : pos === 1 ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  return normalizeVec3(projectPointOnPlane(axis, src));
}

export function closestPointToBox(point: Vec3, mins: Vec3, maxs: Vec3): Vec3 {
  return {
    x: point.x < mins.x ? mins.x : point.x > maxs.x ? maxs.x : point.x,
    y: point.y < mins.y ? mins.y : point.y > maxs.y ? maxs.y : point.y,
    z: point.z < mins.z ? mins.z : point.z > maxs.z ? maxs.z : point.z,
  };
}

export function distanceBetweenBoxesSquared(aMins: Vec3, aMaxs: Vec3, bMins: Vec3, bMaxs: Vec3): number {
  let lengthSq = 0;

  if (aMaxs.x < bMins.x) {
    const d = aMaxs.x - bMins.x;
    lengthSq += d * d;
  } else if (aMins.x > bMaxs.x) {
    const d = aMins.x - bMaxs.x;
    lengthSq += d * d;
  }

  if (aMaxs.y < bMins.y) {
    const d = aMaxs.y - bMins.y;
    lengthSq += d * d;
  } else if (aMins.y > bMaxs.y) {
    const d = aMins.y - bMaxs.y;
    lengthSq += d * d;
  }

  if (aMaxs.z < bMins.z) {
    const d = aMaxs.z - bMins.z;
    lengthSq += d * d;
  } else if (aMins.z > bMaxs.z) {
    const d = aMins.z - bMaxs.z;
    lengthSq += d * d;
  }

  return lengthSq;
}

/**
 * Mirrors PM_ClipVelocity from `rerelease/p_move.cpp`: slide the incoming velocity off
 * a plane normal, applying an overbounce scale and zeroing tiny components so callers can
 * detect blocked axes using STOP_EPSILON.
 */
export function clipVelocityVec3(inVel: Vec3, normal: Vec3, overbounce: number): Vec3 {
  const backoff = dotVec3(inVel, normal) * overbounce;

  let outX = inVel.x - normal.x * backoff;
  let outY = inVel.y - normal.y * backoff;
  let outZ = inVel.z - normal.z * backoff;

  if (outX > -STOP_EPSILON && outX < STOP_EPSILON) {
    outX = 0;
  }

  if (outY > -STOP_EPSILON && outY < STOP_EPSILON) {
    outY = 0;
  }

  if (outZ > -STOP_EPSILON && outZ < STOP_EPSILON) {
    outZ = 0;
  }

  return { x: outX, y: outY, z: outZ };
}

/**
 * Slide a velocity across one or more clip planes using the same plane set resolution logic
 * seen in the inner loop of `PM_StepSlideMove_Generic` (rerelease `p_move.cpp`). When a single
 * plane is provided this devolves to PM_ClipVelocity; with two planes it projects onto the
 * crease defined by their cross product; with more planes it zeroes the velocity to avoid
 * oscillations.
 */
export function clipVelocityAgainstPlanes(
  velocity: Vec3,
  planes: readonly Vec3[],
  overbounce: number,
  primalVelocity?: Vec3,
): Vec3 {
  if (planes.length === 0) {
    return velocity;
  }

  let working = velocity;

  for (let i = 0; i < planes.length; i++) {
    working = clipVelocityVec3(working, planes[i], overbounce);

    let j = 0;
    for (; j < planes.length; j++) {
      if (j === i) {
        continue;
      }

      if (dotVec3(working, planes[j]) < 0) {
        break;
      }
    }

    if (j === planes.length) {
      if (primalVelocity && dotVec3(working, primalVelocity) <= 0) {
        return ZERO_VEC3;
      }

      return working;
    }
  }

  if (planes.length === 2) {
    const dir = crossVec3(planes[0], planes[1]);
    const d = dotVec3(dir, velocity);
    const creaseVelocity = scaleVec3(dir, d);

    if (primalVelocity && dotVec3(creaseVelocity, primalVelocity) <= 0) {
      return ZERO_VEC3;
    }

    return creaseVelocity;
  }

  if (primalVelocity && dotVec3(working, primalVelocity) <= 0) {
    return ZERO_VEC3;
  }

  return ZERO_VEC3;
}

/**
 * Alias retained for ergonomics; mirrors PM_ClipVelocity semantics.
 */
export function slideClipVelocityVec3(inVel: Vec3, normal: Vec3, overbounce: number): Vec3 {
  return clipVelocityVec3(inVel, normal, overbounce);
}

/**
 * Project an offset from a point in forward/right(/up) space into world space.
 * Mirrors G_ProjectSource and G_ProjectSource2 in rerelease q_vec3.
 */
export function projectSourceVec3(point: Vec3, distance: Vec3, forward: Vec3, right: Vec3): Vec3 {
  return {
    x: point.x + forward.x * distance.x + right.x * distance.y,
    y: point.y + forward.y * distance.x + right.y * distance.y,
    z: point.z + forward.z * distance.x + right.z * distance.y + distance.z,
  };
}

export function projectSourceVec3WithUp(point: Vec3, distance: Vec3, forward: Vec3, right: Vec3, up: Vec3): Vec3 {
  return {
    x: point.x + forward.x * distance.x + right.x * distance.y + up.x * distance.z,
    y: point.y + forward.y * distance.x + right.y * distance.y + up.y * distance.z,
    z: point.z + forward.z * distance.x + right.z * distance.y + up.z * distance.z,
  };
}

/**
 * Spherical linear interpolation between two vectors, mirroring q_vec3::slerp.
 * This is intended for direction vectors; callers should pre-normalize if needed.
 */
export function slerpVec3(from: Vec3, to: Vec3, t: number): Vec3 {
  const dot = dotVec3(from, to);
  let aFactor: number;
  let bFactor: number;

  if (Math.abs(dot) > 0.9995) {
    aFactor = 1 - t;
    bFactor = t;
  } else {
    const ang = Math.acos(dot);
    const sinOmega = Math.sin(ang);
    const sinAOmega = Math.sin((1 - t) * ang);
    const sinBOmega = Math.sin(t * ang);
    aFactor = sinAOmega / sinOmega;
    bFactor = sinBOmega / sinOmega;
  }

  return {
    x: from.x * aFactor + to.x * bFactor,
    y: from.y * aFactor + to.y * bFactor,
    z: from.z * aFactor + to.z * bFactor,
  };
}
