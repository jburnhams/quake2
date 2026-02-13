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
    bounds: calculateBounds(frontSides)
  };

  const backBrush: CompileBrush = {
    original: brush.original,
    sides: backSides,
    bounds: calculateBounds(backSides)
  };

  return { front: frontBrush, back: backBrush };
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
