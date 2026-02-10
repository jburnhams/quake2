import type { BrushDef } from '../builder/types.js';
import type { Winding } from '@quake2ts/shared';
import {
  baseWindingForPlane,
  clipWinding,
  windingArea
} from '@quake2ts/shared';

/**
 * Generate windings for all faces of a brush.
 * Returns a map where key is the index of the side in brush.sides.
 * Faces with zero area (clipped away) are excluded.
 */
export function generateBrushWindings(brush: BrushDef): Map<number, Winding> {
  const windings = new Map<number, Winding>();

  for (let i = 0; i < brush.sides.length; i++) {
    const side = brush.sides[i];
    const plane = side.plane;

    // Create huge winding on the plane
    let w: Winding | null = baseWindingForPlane(plane.normal, plane.dist);

    // Clip against all other planes
    for (let j = 0; j < brush.sides.length; j++) {
      if (i === j) continue;

      const clipPlane = brush.sides[j].plane;

      // Keep the part behind the clip plane (inside the brush)
      // Since planes point outwards, "inside" is the back side.
      if (w) {
        w = clipWinding(w, clipPlane.normal, clipPlane.dist, false);
      } else {
        break;
      }
    }

    // If winding is valid and has area, add it
    if (w && w.numPoints >= 3 && windingArea(w) > 0.1) {
      windings.set(i, w);
    }
  }

  return windings;
}
