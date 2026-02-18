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
  windingPlane,
  lengthVec3,
  scaleVec3,
  normalizeVec3,
  distance
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

interface BrushGeometryCache {
  uniqueVertices: Vec3[];
  uniqueEdges: Vec3[];
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

  // 2. Pre-compute geometry cache for valid brushes
  // This avoids re-extracting vertices/edges O(N^2) times
  const geometryCache = new Map<CompileBrush, BrushGeometryCache>();
  // Only cache valid brushes to save time, invalid ones skipped or treated specially
  for (const brush of output) {
    if (isBrushValid(brush)) {
      geometryCache.set(brush, computeBrushGeometry(brush));
    }
  }

  // 3. Check for overlaps between output brushes
  // This is O(N^2), so we might want to skip for large sets
  if (output.length < 500) {
    for (let i = 0; i < output.length; i++) {
      const b1 = output[i];
      if (!isBrushValid(b1)) continue;

      for (let j = i + 1; j < output.length; j++) {
        const b2 = output[j];
        if (!isBrushValid(b2)) continue;

        if (brushesOverlap(b1, b2, geometryCache)) {
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
    return false;
  }

  return true;
}

function computeBrushGeometry(brush: CompileBrush): BrushGeometryCache {
  const uniqueVertices: Vec3[] = [];
  const uniqueEdges: Vec3[] = [];

  for (const s of brush.sides) {
    if (!s.winding) continue;

    // Process vertices
    for (let i = 0; i < s.winding.numPoints; i++) {
      const p = s.winding.points[i];
      let found = false;
      // Simple linear scan for uniqueness (N is small, usually < 20)
      for (const v of uniqueVertices) {
        if (distance(p, v) < 0.001) {
          found = true;
          break;
        }
      }
      if (!found) {
        uniqueVertices.push(p);
      }
    }

    // Process edges
    for (let i = 0; i < s.winding.numPoints; i++) {
      const p1 = s.winding.points[i];
      const p2 = s.winding.points[(i + 1) % s.winding.numPoints];

      const diff = subtractVec3(p2, p1);
      const len = lengthVec3(diff);
      if (len < 0.001) continue; // Skip degenerate edges

      const dir = scaleVec3(diff, 1/len);

      // Check if already present (or opposite)
      let found = false;
      for (const existing of uniqueEdges) {
        const d = Math.abs(dotVec3(dir, existing));
        if (d > 0.999) {
          found = true;
          break;
        }
      }

      if (!found) {
        uniqueEdges.push(dir);
      }
    }
  }

  return { uniqueVertices, uniqueEdges };
}

function brushesOverlap(
  a: CompileBrush,
  b: CompileBrush,
  cache: Map<CompileBrush, BrushGeometryCache>
): boolean {
  // 1. AABB check
  if (!boundsIntersect(a.bounds, b.bounds)) return false;

  const geomA = cache.get(a)!;
  const geomB = cache.get(b)!;

  // 2. Precise check (Separating Axis Theorem for convex polyhedra)
  // If there exists a separating axis, they don't overlap.

  // A. Check if any face plane of A separates B
  if (isSeparatedByPlanes(a, geomB.uniqueVertices)) return false;

  // B. Check if any face plane of B separates A
  if (isSeparatedByPlanes(b, geomA.uniqueVertices)) return false;

  // C. Check axes formed by cross products of edges from A and B
  if (isSeparatedByEdges(geomA, geomB)) return false;

  // If neither separates, they overlap
  return true;
}

function boundsIntersect(a: Bounds3, b: Bounds3): boolean {
  if (a.maxs.x <= b.mins.x || a.mins.x >= b.maxs.x) return false;
  if (a.maxs.y <= b.mins.y || a.mins.y >= b.maxs.y) return false;
  if (a.maxs.z <= b.mins.z || a.mins.z >= b.maxs.z) return false;
  return true;
}

function isSeparatedByPlanes(source: CompileBrush, targetVertices: Vec3[]): boolean {
  // Check if any plane of 'source' separates 'targetVertices' entirely to the "front" (outside)

  for (const side of source.sides) {
    if (!side.winding) continue;

    // Construct plane from winding
    // Note: Ideally we should cache planes too if performance critical,
    // but windingPlane is relatively cheap (cross product).
    const plane = windingPlane(side.winding);

    // Check if ALL vertices of target are in FRONT of this plane
    let allFront = true;

    for (const p of targetVertices) {
      // Calculate distance to plane
      const d = dotVec3(p, plane.normal) - plane.dist;

      // If distance is negative (or zero within epsilon), it's behind/on plane (inside)
      if (d < -0.01) {
        allFront = false;
        break;
      }
    }

    if (allFront) {
      return true;
    }
  }

  return false;
}

function isSeparatedByEdges(geomA: BrushGeometryCache, geomB: BrushGeometryCache): boolean {
  const edgesA = geomA.uniqueEdges;
  const edgesB = geomB.uniqueEdges;

  for (const eA of edgesA) {
    for (const eB of edgesB) {
      // Axis is cross product
      const axisUnnormalized = crossVec3(eA, eB);
      const len = lengthVec3(axisUnnormalized);

      // If edges are parallel, cross product is zero length. Skip.
      if (len < 0.001) continue;

      const axis = scaleVec3(axisUnnormalized, 1/len); // normalize

      // Project both brushes onto axis and check for overlap
      if (isSeparatedOnAxis(geomA.uniqueVertices, geomB.uniqueVertices, axis)) return true;
    }
  }

  return false;
}

function isSeparatedOnAxis(vertsA: Vec3[], vertsB: Vec3[], axis: Vec3): boolean {
  let minA = Infinity, maxA = -Infinity;
  let minB = Infinity, maxB = -Infinity;

  // Project A
  for (const p of vertsA) {
    const d = dotVec3(p, axis);
    if (d < minA) minA = d;
    if (d > maxA) maxA = d;
  }

  // Project B
  for (const p of vertsB) {
    const d = dotVec3(p, axis);
    if (d < minB) minB = d;
    if (d > maxB) maxB = d;
  }

  // Check overlap of [minA, maxA] and [minB, maxB]
  // Allow slight epsilon for touching
  // Separation means gap > epsilon
  if (maxA < minB - 0.001 || maxB < minA - 0.001) return true;

  return false;
}
