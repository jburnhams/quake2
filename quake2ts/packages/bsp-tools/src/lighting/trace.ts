import {
  type Vec3,
  CONTENTS_SOLID,
  CONTENTS_WINDOW,
  subtractVec3,
  addVec3,
  scaleVec3,
  dotVec3
} from '@quake2ts/shared';
import type { TreeElement, TreeLeaf, TreeNode } from '../compiler/tree.js';
import type { CompilePlane } from '../types/compile.js';
import { isLeaf } from '../compiler/tree.js';
import { ON_EPSILON } from '../types/index.js';
import type { Light } from './lights.js';

export interface TraceResult {
  hit: boolean;
  fraction: number;  // 0-1, where hit occurred
  hitPoint?: Vec3;
  hitNormal?: Vec3;
  hitContents?: number;
}

/**
 * Perform a recursive trace line calculation against the BSP tree.
 * Port of TestLine_r from q2tools/src/trace.c
 *
 * @param node The current node or leaf element
 * @param start The start position of the segment
 * @param stop The end position of the segment
 * @param planes The array of BSP compile planes
 * @returns 0 if no occlusion, or the contents that occluded the ray (e.g. CONTENTS_SOLID)
 */
function testLineR(
  element: TreeElement,
  start: Vec3,
  stop: Vec3,
  planes: CompilePlane[]
): number {
  if (isLeaf(element)) {
    // If it's a leaf, check contents
    // In original code, it treats CONTENTS_SOLID and CONTENTS_WINDOW as blocking
    const contents = element.contents;
    // Allow ray to pass through everything except solid and window
    if ((contents & (CONTENTS_SOLID | CONTENTS_WINDOW)) !== 0) {
      // If it's solid or window, it's a hit. But window is somewhat translucent.
      // For shadow tests we typically consider both as occluding.
      if (contents !== CONTENTS_WINDOW) {
        return contents;
      }
      return 0; // In original qrad it returns 0 for CONTENTS_WINDOW for light tests, wait no:
      // if ((r = node & ~(1 << 31)) != CONTENTS_WINDOW) { return r; } return 0;
      // This means if it's window, it does NOT block light (returns 0). If solid, it blocks (returns contents).
    }
    return 0;
  }

  const plane = planes[element.planeNum];

  let front: number;
  let back: number;

  switch (plane.type) {
    case 0: // PLANE_X
      front = start.x - plane.dist;
      back = stop.x - plane.dist;
      break;
    case 1: // PLANE_Y
      front = start.y - plane.dist;
      back = stop.y - plane.dist;
      break;
    case 2: // PLANE_Z
      front = start.z - plane.dist;
      back = stop.z - plane.dist;
      break;
    default:
      front = dotVec3(start, plane.normal) - plane.dist;
      back = dotVec3(stop, plane.normal) - plane.dist;
      break;
  }

  if (front >= -ON_EPSILON && back >= -ON_EPSILON) {
    return testLineR(element.children[0], start, stop, planes);
  }

  if (front < ON_EPSILON && back < ON_EPSILON) {
    return testLineR(element.children[1], start, stop, planes);
  }

  const side = front < 0 ? 1 : 0;

  // Calculate hit fraction
  // Make sure not to divide by zero
  const denom = front - back;
  let frac = 0;
  if (denom !== 0) {
    frac = front / denom;
  }

  const mid = addVec3(start, scaleVec3(subtractVec3(stop, start), frac));

  // Test near side
  let r = testLineR(element.children[side], start, mid, planes);
  if (r !== 0) {
    return r;
  }

  // Test far side
  return testLineR(element.children[1 - side], mid, stop, planes);
}


/**
 * Trace a ray through the BSP tree.
 * Uses the same recursive intersection as TestLine.
 */
export function traceRay(
  start: Vec3,
  end: Vec3,
  tree: TreeElement,
  planes: CompilePlane[]
): TraceResult {
  // A standard trace might need to find the exact point and normal.
  // We'll implement a more complete ray cast for traceRay compared to just boolean testLine.

  let hitFraction = 1.0;
  let hitPlaneNum = -1;
  let hitContents = 0;
  let hitPoint: Vec3 | undefined;
  let hitNormal: Vec3 | undefined;
  let hit = false;

  function traceRecurse(
    element: TreeElement,
    p1: Vec3,
    p2: Vec3,
    p1Frac: number,
    p2Frac: number
  ): void {
    if (hitFraction <= p1Frac) {
      return; // Already hit something closer
    }

    if (isLeaf(element)) {
      if ((element.contents & CONTENTS_SOLID) !== 0) {
        // Hit!
        if (p1Frac < hitFraction) {
          hit = true;
          hitFraction = p1Frac;
          hitContents = element.contents;
          hitPoint = p1;
          // Note: hitNormal needs to be set from the plane we crossed to enter this leaf.
        }
      }
      return;
    }

    const plane = planes[element.planeNum];
    const d1 = dotVec3(p1, plane.normal) - plane.dist;
    const d2 = dotVec3(p2, plane.normal) - plane.dist;

    if (d1 >= -ON_EPSILON && d2 >= -ON_EPSILON) {
      traceRecurse(element.children[0], p1, p2, p1Frac, p2Frac);
      return;
    }

    if (d1 < ON_EPSILON && d2 < ON_EPSILON) {
      traceRecurse(element.children[1], p1, p2, p1Frac, p2Frac);
      return;
    }

    const side = d1 < 0 ? 1 : 0;

    let frac = d1 / (d1 - d2);
    // Clamp fraction to avoid precision errors pushing point off plane
    if (frac < 0) frac = 0;
    if (frac > 1) frac = 1;

    const midFrac = p1Frac + (p2Frac - p1Frac) * frac;
    const mid = addVec3(p1, scaleVec3(subtractVec3(p2, p1), frac));

    traceRecurse(element.children[side], p1, mid, p1Frac, midFrac);

    if (hitFraction <= midFrac) {
      return; // Stop if hit something closer in the front side
    }

    // Entering the back side means we hit the plane if the back side is solid
    const currentHitPlaneNum = element.planeNum;

    // We only set the plane normal if we're hitting a solid leaf in the back side
    // We can't know for sure until traceRecurse completes, so we track the closest hit
    const preHitFraction = hitFraction;
    traceRecurse(element.children[1 - side], mid, p2, midFrac, p2Frac);

    if (hitFraction < preHitFraction) {
      // Something was hit in the back side! This means we entered it through this plane
      if (hitFraction === midFrac) {
         hitPlaneNum = currentHitPlaneNum;
         // Normal should face against the ray direction
         const planeNormal = planes[currentHitPlaneNum].normal;
         hitNormal = side === 0 ? planeNormal : scaleVec3(planeNormal, -1);
      }
    }
  }

  traceRecurse(tree, start, end, 0.0, 1.0);

  return {
    hit,
    fraction: hitFraction,
    hitPoint,
    hitNormal,
    hitContents: hit ? hitContents : undefined
  };
}


/**
 * Test if a point is in shadow from a light.
 * Port of TestLine from q2tools/src/rad.c and q2tools/src/lightmap.c
 */
export function isInShadow(
  point: Vec3,
  light: Light,
  tree: TreeElement,
  planes: CompilePlane[]
): boolean {
  // Original TestLine returns the occlusion (e.g. CONTENTS_SOLID) or 0.
  // If it returns != 0, it means it's blocked by solid.
  // Light position is light.origin
  // We trace from point to light.origin
  const r = testLineR(tree, point, light.origin, planes);
  return r !== 0;
}
