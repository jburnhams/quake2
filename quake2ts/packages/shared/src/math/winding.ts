import {
  type Vec3,
  addVec3,
  copyVec3,
  crossVec3,
  dotVec3,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
} from './vec3.js';

/** A point in a winding (alias for Vec3) */
export type WindingPoint = Vec3;

/** A convex polygon in 3D space */
export interface Winding {
  points: WindingPoint[];
  numPoints: number;
}

/** Maximum points per winding (from q2tools/src/polylib.h:26) */
export const MAX_POINTS_ON_WINDING = 64;

/** Side classification for point/winding vs plane */
export const SIDE_FRONT = 0;
export const SIDE_BACK = 1;
export const SIDE_ON = 2;
export const SIDE_CROSS = 3; // Winding spans plane

/**
 * Maximum world coordinate.
 * Matches BOGUS_RANGE from q2tools/src/mathlib.h (1 << 20 = 1048576).
 * Used for creating base windings that cover the entire map.
 */
export const MAX_WORLD_COORD = 1048576;

/**
 * Creates a new winding with the specified number of points.
 * Points are initialized to {0,0,0}.
 */
export function createWinding(numPoints: number): Winding {
  const points = new Array<Vec3>(numPoints);
  for (let i = 0; i < numPoints; i++) {
    points[i] = { x: 0, y: 0, z: 0 };
  }
  return {
    points,
    numPoints,
  };
}

/**
 * Creates a deep copy of a winding.
 */
export function copyWinding(src: Winding): Winding {
  const points = new Array<Vec3>(src.numPoints);
  for (let i = 0; i < src.numPoints; i++) {
    points[i] = copyVec3(src.points[i]);
  }
  return {
    points,
    numPoints: src.numPoints,
  };
}

/**
 * Creates a new winding with the points in reverse order.
 */
export function reverseWinding(w: Winding): Winding {
  const points = new Array<Vec3>(w.numPoints);
  for (let i = 0; i < w.numPoints; i++) {
    points[i] = copyVec3(w.points[w.numPoints - 1 - i]);
  }
  return {
    points,
    numPoints: w.numPoints,
  };
}

/**
 * No-op in JS, included for API parity with C source.
 */
export function freeWinding(w: Winding): void {
  // No-op
}

/**
 * Creates a very large square winding lying on the given plane.
 * This is the starting point before clipping to brush bounds.
 *
 * Algorithm matches q2tools BaseWindingForPlane.
 */
export function baseWindingForPlane(normal: Vec3, dist: number): Winding {
  // Find the major axis
  let max = -MAX_WORLD_COORD; // Use -BOGUS_RANGE conceptually
  let x = -1;

  if (Math.abs(normal.x) > max) {
    x = 0;
    max = Math.abs(normal.x);
  }
  if (Math.abs(normal.y) > max) {
    x = 1;
    max = Math.abs(normal.y);
  }
  if (Math.abs(normal.z) > max) {
    x = 2;
    max = Math.abs(normal.z);
  }

  let vup: Vec3 = { x: 0, y: 0, z: 0 };
  switch (x) {
    case 0:
    case 1:
      vup = { x: 0, y: 0, z: 1 };
      break;
    case 2:
      vup = { x: 1, y: 0, z: 0 };
      break;
  }

  const v = dotVec3(vup, normal);
  // vup = vup - v * normal
  vup = subtractVec3(vup, scaleVec3(normal, v));
  vup = normalizeVec3(vup);

  const org = scaleVec3(normal, dist);
  const vright = crossVec3(vup, normal);

  // Scale up to MAX_WORLD_COORD
  const vupScaled = scaleVec3(vup, MAX_WORLD_COORD);
  const vrightScaled = scaleVec3(vright, MAX_WORLD_COORD);

  const w = createWinding(4);

  // p[0] = org - vright + vup
  let p0 = subtractVec3(org, vrightScaled);
  p0 = addVec3(p0, vupScaled);
  w.points[0] = p0;

  // p[1] = org + vright + vup
  let p1 = addVec3(org, vrightScaled);
  p1 = addVec3(p1, vupScaled);
  w.points[1] = p1;

  // p[2] = org + vright - vup
  let p2 = addVec3(org, vrightScaled);
  p2 = subtractVec3(p2, vupScaled);
  w.points[2] = p2;

  // p[3] = org - vright - vup
  let p3 = subtractVec3(org, vrightScaled);
  p3 = subtractVec3(p3, vupScaled);
  w.points[3] = p3;

  return w;
}
