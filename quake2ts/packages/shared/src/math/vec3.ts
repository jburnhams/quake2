export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

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
