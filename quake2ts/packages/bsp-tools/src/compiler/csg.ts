import {
  splitWinding,
  windingBounds,
  createEmptyBounds3,
  scaleVec3,
  baseWindingForPlane,
  chopWindingByPlanes,
  windingPlane,
  type Winding,
  type Vec3,
  type Bounds3
} from '@quake2ts/shared';
import type { CompileBrush, CompilePlane, CompileSide } from '../types/compile.js';
import type { PlaneSet } from './planes.js';

export interface BrushSplitResult {
  front: CompileBrush | null;
  back: CompileBrush | null;
}

/**
 * Split a brush by a plane.
 *
 * @param brush The brush to split.
 * @param planeNum The index of the split plane.
 * @param plane The split plane itself.
 * @param planeSet The PlaneSet used to find/add the opposite plane for the front fragment.
 * @param texInfo Optional texture info for the new face created by the split. Defaults to 0.
 */
export function splitBrush(
  brush: CompileBrush,
  planeNum: number,
  plane: CompilePlane,
  planeSet: PlaneSet,
  texInfo: number = 0
): BrushSplitResult {
  const frontSides: CompileSide[] = [];
  const backSides: CompileSide[] = [];
  const frontPlanes: { normal: Vec3; dist: number }[] = [];
  const backPlanes: { normal: Vec3; dist: number }[] = [];

  // 1. Split existing sides
  for (const side of brush.sides) {
    if (!side.winding) {
      continue;
    }

    const split = splitWinding(side.winding, plane.normal, plane.dist);

    if (split.front) {
      frontSides.push({
        planeNum: side.planeNum,
        texInfo: side.texInfo,
        winding: split.front,
        visible: side.visible,
        tested: side.tested,
        bevel: side.bevel
      });
      // Capture plane definition for capping
      const wp = windingPlane(side.winding);
      frontPlanes.push(wp);
    }

    if (split.back) {
      backSides.push({
        planeNum: side.planeNum,
        texInfo: side.texInfo,
        winding: split.back,
        visible: side.visible,
        tested: side.tested,
        bevel: side.bevel
      });
      const wp = windingPlane(side.winding);
      backPlanes.push(wp);
    }
  }

  // If nothing on front or nothing on back, return early
  if (frontSides.length === 0) {
    return { front: null, back: brush };
  }
  if (backSides.length === 0) {
    return { front: brush, back: null };
  }

  // 2. Create new face for FRONT fragment (on opposite plane)
  // The front fragment is on the positive side of 'plane'.
  // The bounding plane must point INWARDS to the fragment, so away from front.
  // Standard Quake brushes have planes pointing OUTWARDS.
  // So the plane bounding the FRONT fragment (which is on positive side) must point towards negative side.
  // So normal is -plane.normal.
  const normalInv = scaleVec3(plane.normal, -1);
  const distInv = -plane.dist;

  const oppositePlaneNum = planeSet.findOrAdd(normalInv, distInv);

  // Generate winding for the new face on the front fragment
  // Start with huge winding on opposite plane, clip by all ORIGINAL brush planes that survived
  let frontCapWinding: Winding | null = baseWindingForPlane(normalInv, distInv);
  if (frontCapWinding) {
    frontCapWinding = chopWindingByPlanes(frontCapWinding, frontPlanes);
  }

  if (frontCapWinding) {
    frontSides.push({
      planeNum: oppositePlaneNum,
      texInfo: texInfo,
      winding: frontCapWinding,
      visible: true,
      tested: false,
      bevel: false
    });
  }

  // 3. Create new face for BACK fragment (on split plane)
  // The back fragment is on the negative side of 'plane'.
  // The bounding plane must point OUTWARDS, so towards positive side.
  // So normal is plane.normal.
  let backCapWinding: Winding | null = baseWindingForPlane(plane.normal, plane.dist);
  if (backCapWinding) {
    backCapWinding = chopWindingByPlanes(backCapWinding, backPlanes);
  }

  if (backCapWinding) {
    backSides.push({
      planeNum: planeNum, // The original plane index
      texInfo: texInfo,
      winding: backCapWinding,
      visible: true,
      tested: false,
      bevel: false
    });
  }

  // 4. Construct result brushes
  const frontBrush: CompileBrush = {
    original: brush.original,
    sides: frontSides,
    bounds: calculateBounds(frontSides),
    next: null
  };

  const backBrush: CompileBrush = {
    original: brush.original,
    sides: backSides,
    bounds: calculateBounds(backSides),
    next: null
  };

  return {
    front: isBrushValid(frontBrush) ? frontBrush : null,
    back: isBrushValid(backBrush) ? backBrush : null
  };
}

function isBrushValid(brush: CompileBrush): boolean {
  const b = brush.bounds;
  if (b.maxs.x - b.mins.x < 0.1) return false;
  if (b.maxs.y - b.mins.y < 0.1) return false;
  if (b.maxs.z - b.mins.z < 0.1) return false;
  return true;
}

export function calculateBounds(sides: CompileSide[]): Bounds3 {
  return sides.reduce((bounds, side) => {
    if (!side.winding) return bounds;
    const wb = windingBounds(side.winding);
    return {
      mins: {
        x: Math.min(bounds.mins.x, wb.mins.x),
        y: Math.min(bounds.mins.y, wb.mins.y),
        z: Math.min(bounds.mins.z, wb.mins.z)
      },
      maxs: {
        x: Math.max(bounds.maxs.x, wb.maxs.x),
        y: Math.max(bounds.maxs.y, wb.maxs.y),
        z: Math.max(bounds.maxs.z, wb.maxs.z)
      }
    };
  }, createEmptyBounds3());
}

/**
 * Updates the bounds of a brush based on its sides/windings.
 * This is an alias for calculateBounds but updates the brush in place.
 */
export function updateBrushBounds(brush: CompileBrush): void {
  brush.bounds = calculateBounds(brush.sides);
}

// -----------------------------------------------------------------------------
// Brush List Management
// -----------------------------------------------------------------------------

/**
 * A linked list of brushes.
 * Useful for managing fragments during CSG operations.
 */
export interface BrushList {
  head: CompileBrush | null;
  tail: CompileBrush | null;
  count: number;
}

/**
 * Creates a new empty brush list.
 */
export function createBrushList(): BrushList {
  return { head: null, tail: null, count: 0 };
}

/**
 * Adds a brush to the end of the list.
 */
export function addBrush(list: BrushList, brush: CompileBrush): void {
  brush.next = null; // Ensure it's not pointing to anything
  if (!list.head) {
    list.head = brush;
    list.tail = brush;
  } else {
    // List has elements, append to tail
    // This is safe because list.tail is guaranteed to be non-null if list.head is non-null
    list.tail!.next = brush;
    list.tail = brush;
  }
  list.count++;
}

/**
 * Counts the number of brushes in the list by traversing it.
 * Use list.count for cached value.
 */
export function countBrushes(list: BrushList): number {
  let count = 0;
  for (let b = list.head; b; b = b.next) {
    count++;
  }
  return count;
}

/**
 * Frees a brush list (clears references).
 * In JS/TS this just clears the head/tail, letting GC handle the nodes if not referenced elsewhere.
 */
export function freeBrushList(list: BrushList): void {
  list.head = null;
  list.tail = null;
  list.count = 0;
}

/**
 * Frees a single brush.
 * In JS/TS this is mostly a no-op but useful for API parity or pooling future-proofing.
 */
export function freeBrush(brush: CompileBrush): void {
  brush.next = null;
  // Could clear sides/windings if aggressive cleanup needed
}

// -----------------------------------------------------------------------------
// CSG Operations
// -----------------------------------------------------------------------------

/**
 * Subtracts brush B from brush A.
 * Returns a linked list of fragments of A that are OUTSIDE of B.
 * If A is entirely inside B, returns null.
 * If A is entirely outside B, returns A (or a copy of A).
 *
 * This operation consumes A (it may be split into fragments).
 * B is only read.
 *
 * @param a The brush to be subtracted from.
 * @param b The subtractor brush.
 * @param planeSet The PlaneSet for looking up plane data.
 * @returns The head of the resulting fragment list.
 */
export function subtractBrush(
  a: CompileBrush,
  b: CompileBrush,
  planeSet: PlaneSet
): CompileBrush | null {
  // If bounds don't intersect, A is completely outside B
  // This is a quick optimization check
  if (!boundsIntersect(a.bounds, b.bounds)) {
    return a;
  }

  const frontList = createBrushList();
  let insideBrush: CompileBrush | null = a;

  const planes = planeSet.getPlanes();

  for (const side of b.sides) {
    if (!insideBrush) break;

    const plane = planes[side.planeNum];

    // Split the current inside portion by the plane of B's side.
    // The plane normal points OUT of B.
    // So FRONT is OUTSIDE B.
    // BACK is INSIDE B (at least relative to this plane).
    const split = splitBrush(insideBrush, side.planeNum, plane, planeSet, side.texInfo);

    if (split.front) {
      // The front part is definitely outside B because it is in front of one of B's planes.
      addBrush(frontList, split.front);
    }

    // Continue processing the back part (which is inside this plane) against other planes.
    insideBrush = split.back;
  }

  // Whatever remains in insideBrush is inside ALL planes of B, so it is inside the volume of B.
  // Since we are subtracting B from A, we discard this inside portion.
  // (In C code this would be explicitly freed)
  if (insideBrush) {
    freeBrush(insideBrush);
  }

  return frontList.head;
}

function boundsIntersect(a: Bounds3, b: Bounds3): boolean {
  if (a.maxs.x < b.mins.x || a.mins.x > b.maxs.x) return false;
  if (a.maxs.y < b.mins.y || a.mins.y > b.maxs.y) return false;
  if (a.maxs.z < b.mins.z || a.mins.z > b.maxs.z) return false;
  return true;
}

export interface CsgOptions {
  /** Keep detail brushes separate (don't let them cut structural brushes) */
  preserveDetail?: boolean;

  /** Verbose logging */
  verbose?: boolean;
}

const CONTENTS_DETAIL = 0x8000000;

/**
 * Process all brushes with CSG.
 * Splits overlapping brushes and removes hidden portions.
 *
 * @param brushes The input list of brushes (MapBrush converted to CompileBrush).
 * @param planeSet The PlaneSet used for splitting.
 * @param options CSG options.
 * @returns A list of non-overlapping fragments.
 */
export function processCsg(
  brushes: CompileBrush[],
  planeSet: PlaneSet,
  options?: CsgOptions
): CompileBrush[] {
  // We'll maintain a linked list of output brushes
  let head: CompileBrush | null = null;
  let tail: CompileBrush | null = null;

  const verbose = options?.verbose ?? false;
  const preserveDetail = options?.preserveDetail ?? false;

  for (let i = 0; i < brushes.length; i++) {
    const brush = brushes[i];

    // In standard Q2 CSG:
    // New brush (brush) cuts existing brushes (in the list).
    // Existing brushes DO NOT cut the new brush.
    // The new brush is added "on top" (conceptually, filling the space).

    const isDetail = (brush.original.contents & CONTENTS_DETAIL) !== 0;

    // We iterate over the EXISTING output list and modify it (subtract 'brush' from 'current').

    let current: CompileBrush | null = head;
    let prev: CompileBrush | null = null;

    while (current) {
      const a = current as CompileBrush;
      const next = a.next; // Save next because current might be modified/removed

      const aIsDetail = (a.original.contents & CONTENTS_DETAIL) !== 0;

      // Should we subtract 'brush' from 'a'?
      // If preserveDetail is on:
      // - If 'brush' is detail and 'a' is structural: NO. Detail doesn't cut structural.
      // - Otherwise: YES.

      let shouldSubtract = true;
      if (preserveDetail) {
        if (isDetail && !aIsDetail) {
          shouldSubtract = false;
        }
      }

      if (shouldSubtract && boundsIntersect(a.bounds, brush.bounds)) {
        // Subtract brush (b) from a
        // result is a list of fragments of a that are OUTSIDE brush
        const fragmentsHead = subtractBrush(a, brush, planeSet);

        if (fragmentsHead) {
           // A was split or preserved (if no overlap after all).
           // If fragmentsHead is exactly 'a' (same object), nothing changed.
           if (fragmentsHead === a) {
             // No change
             prev = current;
           } else {
             // 'a' was split into fragments. Replace 'a' with fragmentsHead.
             if (prev) {
               prev.next = fragmentsHead;
             } else {
               head = fragmentsHead;
             }

             // Find the new tail of this fragment chain to connect to 'next'
             let f = fragmentsHead;
             while (f.next) {
               f = f.next;
             }
             f.next = next; // Reconnect to rest of list

             // Update 'prev' to be the last fragment
             prev = f;

             // If 'current' was the tail, we need to update tail to point to the last fragment
             if (current === tail) {
               tail = f;
             }
           }
        } else {
           // A is completely inside B. Remove A.
           if (prev) {
             prev.next = next;
           } else {
             head = next;
           }
           // If A was the tail, update tail to prev
           if (current === tail) {
             tail = prev;
           }
           // 'prev' stays same (points to node before A).
        }
      } else {
        // No overlap or skipped, keep A
        prev = current;
      }

      current = next;
    }

    // Finally add 'brush' to the end of the list
    // We make a shallow copy of 'brush' to safely modify 'next'
    // without affecting the input array's objects (if they are reused).
    const newBrush: CompileBrush = {
      ...brush,
      next: null
    };

    if (!head) {
      head = newBrush;
      tail = newBrush;
    } else {
      // Use tail pointer for O(1) append
      if (tail) {
        tail.next = newBrush;
        tail = newBrush;
      } else {
        // Fallback should theoretically not happen if logic is correct, but for safety:
        let t = head;
        while (t.next) t = t.next;
        t.next = newBrush;
        tail = newBrush;
      }
    }
  }

  // Convert linked list back to array
  const result: CompileBrush[] = [];
  let c = head;
  while (c) {
    result.push(c);
    c = c.next;
  }
  return result;
}
