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
  const points = Array.from({ length: numPoints }, () => ({ x: 0, y: 0, z: 0 }));
  return {
    points,
    numPoints,
  };
}

/**
 * Creates a deep copy of a winding.
 */
export function copyWinding(src: Winding): Winding {
  const points = src.points.map(copyVec3);
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
  // p[0] = org - vright + vup
  w.points[0] = addVec3(subtractVec3(org, vrightScaled), vupScaled);

  // p[1] = org + vright + vup
  w.points[1] = addVec3(addVec3(org, vrightScaled), vupScaled);

  // p[2] = org + vright - vup
  w.points[2] = subtractVec3(addVec3(org, vrightScaled), vupScaled);

  // p[3] = org - vright - vup
  w.points[3] = subtractVec3(subtractVec3(org, vrightScaled), vupScaled);

  return w;
}

/**
 * Classifies a winding against a plane.
 * Returns SIDE_FRONT, SIDE_BACK, SIDE_ON, or SIDE_CROSS.
 */
export function windingOnPlaneSide(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon: number = 0.1
): number {
  let front = false;
  let back = false;

  for (let i = 0; i < w.numPoints; i++) {
    const d = dotVec3(w.points[i], normal) - dist;
    if (d < -epsilon) {
      back = true;
    } else if (d > epsilon) {
      front = true;
    }
  }

  if (back && front) return SIDE_CROSS;
  if (front) return SIDE_FRONT;
  if (back) return SIDE_BACK;
  return SIDE_ON;
}

/**
 * Clips a winding to one side of a plane.
 * If keepFront is true, keeps the portion in front of the plane.
 * If keepFront is false, keeps the portion behind the plane.
 * Returns null if the winding is completely clipped away.
 */
export function clipWindingEpsilon(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon: number,
  keepFront: boolean
): Winding | null {
  const dists: number[] = new Array(MAX_POINTS_ON_WINDING + 4);
  const sides: number[] = new Array(MAX_POINTS_ON_WINDING + 4);
  let counts: [number, number, number] = [0, 0, 0];

  let dot: number;
  for (let i = 0; i < w.numPoints; i++) {
    dot = dotVec3(w.points[i], normal);
    dists[i] = dot - dist;
    if (dists[i] > epsilon) {
      sides[i] = SIDE_FRONT;
    } else if (dists[i] < -epsilon) {
      sides[i] = SIDE_BACK;
    } else {
      sides[i] = SIDE_ON;
    }
    counts[sides[i]]++;
  }

  // Wrap around for easier loop
  sides[w.numPoints] = sides[0];
  dists[w.numPoints] = dists[0];

  // If the winding is entirely on the kept side, return a copy
  if (keepFront) {
    if (counts[SIDE_BACK] === 0) return copyWinding(w);
    if (counts[SIDE_FRONT] === 0) return null;
  } else {
    if (counts[SIDE_FRONT] === 0) return copyWinding(w);
    if (counts[SIDE_BACK] === 0) return null;
  }

  const newW = createWinding(0); // empty winding initially
  newW.points = []; // start empty to push

  for (let i = 0; i < w.numPoints; i++) {
    const p1 = w.points[i];

    if (sides[i] === SIDE_ON) {
      newW.points.push(copyVec3(p1));
      continue;
    }

    if (sides[i] === (keepFront ? SIDE_FRONT : SIDE_BACK)) {
      newW.points.push(copyVec3(p1));
    }

    if (sides[i + 1] === SIDE_ON || sides[i + 1] === sides[i]) {
      continue;
    }

    // Generate a split point
    const p2 = w.points[(i + 1) % w.numPoints];

    dot = dists[i] / (dists[i] - dists[i + 1]);

    const mid: Vec3 = {
      x: p1.x + dot * (p2.x - p1.x),
      y: p1.y + dot * (p2.y - p1.y),
      z: p1.z + dot * (p2.z - p1.z),
    };

    newW.points.push(mid);
  }

  // Handle potential degeneration or empty result
  if (newW.points.length < 3) {
    return null;
  }

  newW.numPoints = newW.points.length;
  return newW;
}

/**
 * Convenience wrapper for clipWindingEpsilon with default epsilon.
 */
export function clipWinding(
  w: Winding,
  normal: Vec3,
  dist: number,
  keepFront: boolean
): Winding | null {
  return clipWindingEpsilon(w, normal, dist, 0.1, keepFront);
}

export interface WindingSplit {
  front: Winding | null;
  back: Winding | null;
}

/**
 * Splits a winding by a plane.
 */
export function splitWinding(
  w: Winding,
  normal: Vec3,
  dist: number,
  epsilon: number = 0.1
): WindingSplit {
  const dists: number[] = new Array(MAX_POINTS_ON_WINDING + 4);
  const sides: number[] = new Array(MAX_POINTS_ON_WINDING + 4);
  let counts: [number, number, number] = [0, 0, 0];

  let dot: number;
  for (let i = 0; i < w.numPoints; i++) {
    dot = dotVec3(w.points[i], normal);
    dists[i] = dot - dist;
    if (dists[i] > epsilon) {
      sides[i] = SIDE_FRONT;
    } else if (dists[i] < -epsilon) {
      sides[i] = SIDE_BACK;
    } else {
      sides[i] = SIDE_ON;
    }
    counts[sides[i]]++;
  }

  sides[w.numPoints] = sides[0];
  dists[w.numPoints] = dists[0];

  if (counts[SIDE_FRONT] === 0 && counts[SIDE_BACK] === 0) {
    // Both front and back get a copy if it's ON the plane
    return { front: copyWinding(w), back: copyWinding(w) };
  }

  if (counts[SIDE_FRONT] === 0) {
    return { front: null, back: copyWinding(w) };
  }
  if (counts[SIDE_BACK] === 0) {
    return { front: copyWinding(w), back: null };
  }

  const f = createWinding(0); f.points = [];
  const b = createWinding(0); b.points = [];

  for (let i = 0; i < w.numPoints; i++) {
    const p1 = w.points[i];

    if (sides[i] === SIDE_ON) {
      f.points.push(copyVec3(p1));
      b.points.push(copyVec3(p1));
      continue;
    }

    if (sides[i] === SIDE_FRONT) {
      f.points.push(copyVec3(p1));
    }
    if (sides[i] === SIDE_BACK) {
      b.points.push(copyVec3(p1));
    }

    if (sides[i + 1] === SIDE_ON || sides[i + 1] === sides[i]) {
      continue;
    }

    // Generate split point
    const p2 = w.points[(i + 1) % w.numPoints];

    dot = dists[i] / (dists[i] - dists[i + 1]);

    const mid: Vec3 = {
      x: p1.x + dot * (p2.x - p1.x),
      y: p1.y + dot * (p2.y - p1.y),
      z: p1.z + dot * (p2.z - p1.z),
    };

    f.points.push(copyVec3(mid));
    b.points.push(copyVec3(mid));
  }

  // Handle degenerate cases
  const frontW = f.points.length >= 3 ? f : null;
  const backW = b.points.length >= 3 ? b : null;

  if (frontW) frontW.numPoints = frontW.points.length;
  if (backW) backW.numPoints = backW.points.length;

  return { front: frontW, back: backW };
}
