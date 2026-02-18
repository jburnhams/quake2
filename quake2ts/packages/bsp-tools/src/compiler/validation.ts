import {
  type Bounds3,
  type Vec3,
  type Winding,
  windingBounds,
  createEmptyBounds3,
  addPointToBounds,
  windingCenter,
  dotVec3,
  subtractVec3,
  crossVec3,
  windingPlane
} from '@quake2ts/shared';
import type { CompileBrush } from '../types/compile.js';

export interface CsgValidation {
  valid: boolean;
  errors: string[];
  stats: {
    inputBrushes: number;
    outputFragments: number;
    degenerateBrushes: number;
  };
}

/**
 * Validates the result of a CSG operation.
 * Checks for validity of output brushes and ensures no overlaps.
 */
export function validateCsgResult(
  input: CompileBrush[],
  output: CompileBrush[]
): CsgValidation {
  const errors: string[] = [];
  let degenerateBrushes = 0;

  // 1. Validate individual output brushes
  for (let i = 0; i < output.length; i++) {
    const brush = output[i];
    if (!isBrushValid(brush)) {
      errors.push(`Output brush ${i} is invalid (degenerate or missing sides)`);
      degenerateBrushes++;
    }
  }

  // 2. Check for overlaps between output brushes
  // This is O(N^2), so we might want to skip for large sets or use spatial hash
  // For validation, O(N^2) is acceptable for reasonable N (e.g. < 1000)
  if (output.length < 500) {
    for (let i = 0; i < output.length; i++) {
      for (let j = i + 1; j < output.length; j++) {
        if (brushesOverlap(output[i], output[j])) {
          errors.push(`Output brushes ${i} and ${j} overlap`);
          // Limit errors
          if (errors.length > 10) {
            errors.push('... too many overlap errors ...');
            break;
          }
        }
      }
      if (errors.length > 10) break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    stats: {
      inputBrushes: input.length,
      outputFragments: output.length,
      degenerateBrushes
    }
  };
}

function isBrushValid(brush: CompileBrush): boolean {
  if (brush.sides.length < 4) return false;

  // Check bounds volume
  const b = brush.bounds;
  if (b.maxs.x <= b.mins.x || b.maxs.y <= b.mins.y || b.maxs.z <= b.mins.z) {
    // Zero or negative volume
    return false;
  }

  return true;
}

function brushesOverlap(a: CompileBrush, b: CompileBrush): boolean {
  // 1. AABB check
  if (!boundsIntersect(a.bounds, b.bounds)) return false;

  // 2. Precise check (Separating Axis Theorem for convex polyhedra)
  // If there exists a separating plane, they don't overlap.
  // The separating plane must be one of the face planes of A or B.

  // Check if any plane of A separates B
  if (isSeparatedByPlanes(a, b)) return false;

  // Check if any plane of B separates A
  if (isSeparatedByPlanes(b, a)) return false;

  // If neither separates, they overlap
  return true;
}

function boundsIntersect(a: Bounds3, b: Bounds3): boolean {
  if (a.maxs.x <= b.mins.x || a.mins.x >= b.maxs.x) return false;
  if (a.maxs.y <= b.mins.y || a.mins.y >= b.maxs.y) return false;
  if (a.maxs.z <= b.mins.z || a.mins.z >= b.maxs.z) return false;
  return true;
}

function isSeparatedByPlanes(source: CompileBrush, target: CompileBrush): boolean {
  // Check if any plane of 'source' separates 'target' entirely to the "front" (outside)
  // Brushes are convex intersections of half-spaces (insides).
  // Inside is "back" side of plane (distance < 0 relative to normal pointing out).
  // "Front" is outside.
  // If target is entirely in front of ANY plane of source, then they are disjoint.

  for (const side of source.sides) {
    if (!side.winding) continue;

    // Construct plane from winding
    const plane = windingPlane(side.winding);

    // Check if ALL points of target are in FRONT of this plane
    let allFront = true;

    // Check all vertices of target
    for (const ts of target.sides) {
      if (!ts.winding) continue;
      for (const p of ts.winding.points) {
        // Calculate distance to plane
        const d = dotVec3(p, plane.normal) - plane.dist;

        // If distance is negative (or zero within epsilon), it's behind/on plane (inside)
        // We want strict separation (or touching?)
        // If they just touch, they don't overlap volume-wise.
        // So allow d > -epsilon.
        // If d < -epsilon, then point is inside.
        if (d < -0.01) {
          allFront = false;
          break;
        }
      }
      if (!allFront) break;
    }

    if (allFront) {
      // Found a separating plane!
      return true;
    }
  }

  return false;
}
