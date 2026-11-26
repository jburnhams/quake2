import { describe, it, expect } from 'vitest';
import {
  type Bounds3,
  createEmptyBounds3,
  windingBounds,
  createWinding,
  baseWindingForPlane,
  chopWindingByPlanes,
  windingPlane,
  type Vec3,
  addVec3,
  scaleVec3,
  dotVec3,
  crossVec3,
  normalizeVec3
} from '@quake2ts/shared';
import { validateCsgResult } from '../../../src/compiler/validation';
import type { CompileBrush, CompileSide, MapBrush } from '../../../src/types/compile';

// Helper to create a brush from planes
function createBrushFromPlanes(planes: { normal: Vec3; dist: number }[]): CompileBrush {
  const sides: CompileSide[] = [];

  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    let w = baseWindingForPlane(p.normal, p.dist);

    // Chop by other planes
    const clipPlanes = planes.filter((_, idx) => idx !== i);
    w = chopWindingByPlanes(w, clipPlanes)!;

    if (w && w.numPoints >= 3) {
      sides.push({
        planeNum: i,
        texInfo: 0,
        winding: w,
        visible: true,
        tested: false,
        bevel: false
      });
    }
  }

  // Calculate bounds
  let bounds = createEmptyBounds3();
  for (const s of sides) {
    if (s.winding) {
        const wb = windingBounds(s.winding);
        bounds.mins.x = Math.min(bounds.mins.x, wb.mins.x);
        bounds.mins.y = Math.min(bounds.mins.y, wb.mins.y);
        bounds.mins.z = Math.min(bounds.mins.z, wb.mins.z);
        bounds.maxs.x = Math.max(bounds.maxs.x, wb.maxs.x);
        bounds.maxs.y = Math.max(bounds.maxs.y, wb.maxs.y);
        bounds.maxs.z = Math.max(bounds.maxs.z, wb.maxs.z);
    }
  }

  return {
    original: {} as MapBrush,
    sides,
    bounds,
    next: null
  };
}

// Helper to rotate a vector around X axis
function rotateX(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x,
    y: v.y * c - v.z * s,
    z: v.y * s + v.z * c
  };
}

// Helper to rotate a vector around Y axis
function rotateY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return {
    x: v.x * c + v.z * s,
    y: v.y,
    z: -v.x * s + v.z * c
  };
}

// Helper to create a rotated box
function createRotatedBox(center: Vec3, size: Vec3, angleX: number, angleY: number): CompileBrush {
  // Define 6 planes for axis aligned box, then rotate normals and adjust dist
  const halfSize = scaleVec3(size, 0.5);
  const normals = [
    { x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }
  ];

  const planes = normals.map(n => {
    // Rotate normal
    let rn = rotateX(n, angleX);
    rn = rotateY(rn, angleY);

    // Calculate distance
    // Plane equation: dot(p, n) = dist
    // Center is on plane if dist = dot(center, n).
    // But these are bounding planes.
    // For original box, plane +X is at x=halfSize.x.
    // Point on plane: center + halfSize.x * (1,0,0) (rotated).

    // Better way:
    // Box vertices are center +/- rotated(halfSize * axis).
    // Actually, box is convex hull of rotated corners.
    // Or just rotate the standard planes.
    // Plane +X dist: dot(center + rotated(halfSize.x * X), rotated(X)) = dot(center, rX) + halfSize.x
    // Wait.
    // dot(p, n) = d.
    // p = center + rX * halfSize.x.
    // n = rX.
    // d = dot(center, rX) + halfSize.x * dot(rX, rX) = dot(center, rX) + halfSize.x.

    // But this is only for +X plane.
    // What about +Y?
    // p = center + rY * halfSize.y.

    // General:
    // For plane corresponding to original normal N (e.g. 1,0,0):
    // It passes through point P = center + scaleVec3(rN, corresponding_half_size).
    // dist = dot(P, rN).

    // Determine corresponding half size dimension
    let dim = 0;
    if (Math.abs(n.x) > 0.9) dim = halfSize.x;
    if (Math.abs(n.y) > 0.9) dim = halfSize.y;
    if (Math.abs(n.z) > 0.9) dim = halfSize.z;

    const dist = dotVec3(center, rn) + dim;
    return { normal: rn, dist };
  });

  return createBrushFromPlanes(planes);
}

describe('validateCsgResult Edge Case', () => {
  it('detects separation by edge-edge axis when face normals overlap', () => {
    // Construct two brushes that are disjoint but only separated by an edge-edge axis.

    // Brush A: Box 4x1x1 at origin, rotated 45 deg around Y.
    // Axis A is (1, 0, 1) normalized.
    // Brush B: Box 4x1x1, rotated -45 deg around Y? Or 45 deg around X?
    // Let's try 45 deg around Y but perpendicular?
    // Brush A lies in X-Z plane, diagonal.
    // Brush B lies in Y-Z plane?

    // Let's try the classic edge-edge case:
    // Two cubes.
    // Cube A: Axis aligned at (0,0,0). Size 2.
    // Cube B: Rotated 45 deg around X, 45 deg around Z?
    // And positioned such that a vertex of B is close to an edge of A?

    // Let's try:
    // Brush A: Box along X. Size 10, 2, 2. Rotated 45 Y.
    // Brush B: Box along Y. Size 2, 10, 2. Rotated 45 X.

    // A orientation: X axis becomes (0.7, 0, 0.7). Y axis (0, 1, 0). Z axis (-0.7, 0, 0.7).
    // B orientation: X axis (1, 0, 0). Y axis (0, 0.7, 0.7). Z axis (0, -0.7, 0.7).

    // Position them such that they cross in the middle but with vertical separation?
    // If separated by Z (vertical), face normals might catch it.
    // We want them to pass *through* each other's face projection shadows.

    // Let's use simple non-colliding crossing.
    // A center: (0, 0, 0).
    // B center: (0, 0, 2.5). (Vertical separation).
    // A is flat on X-Z. B is flat on Y-Z?
    // If A is (10, 10, 1). B is (1, 1, 10).
    // A face normals: Z (0,0,1).
    // B face normals: X (1,0,0).
    // Z normal separates them? A in [-0.5, 0.5]. B in [-5, 5]? No.
    // Wait.
    // If A is 10x10x1. Z range [-0.5, 0.5].
    // If B is 1x1x10. Z range [-5, 5].
    // They overlap in Z.
    // They overlap in X (A is wide).
    // They overlap in Y (A is wide).
    // So AABB overlaps.
    // Face normals?
    // A faces: +/-Z. Projections: A is thin, B is thick. B spans A. No separation.
    // B faces: +/-X, +/-Y. A spans B. No separation.

    // So two crossing plates?
    // A: 10x10x1. B: 1x1x10.
    // They intersect!
    // We need them to be disjoint.
    // A: 10x10x1 at Z=0.
    // B: 1x1x10 at Z=0.
    // intersection is 1x1x1 cube in center.

    // Rotate B so it passes through a "hole"? Or just misses?
    // Disjointness requires separation.

    // Try:
    // A: Rotated cube.
    // B: Rotated cube.
    // Close to each other.

    // Let's use the property that SAT requires edge axes.
    // If we only check faces, we miss some separating axes.
    // So there exist configurations where faces say "overlap" but edges say "separate".
    // This implies the separating axis is NOT a face normal.

    // Example: Two cubes touching edge-to-edge?
    // Cube A at (-1.1, -1.1, -1.1) to (0.9, 0.9, 0.9)? No.

    // Let's try to construct a case that fails:
    // Two tetrahedra.
    // Tet A: (1,1,1), (1,-1,-1), (-1,1,-1), (-1,-1,1).
    // Tet B: Same, shifted by (2.1, 0, 0)?
    // Separation is along X (1,0,0).
    // Face normals of Tet A:
    // (1,1,1) cross (1,-1,-1) -> ...
    // Faces are (1,1,1), (1,-1,-1), (-1,1,-1) -> Normal (1,1,1)? No.
    // Faces normals are (1/sqrt3)(1,1,1), etc.
    // (1,0,0) is NOT a face normal.
    // But (1,1,1) has X component.
    // Projection of A on (1,1,1) is...
    // Projection of B on (1,1,1) is...
    // If B is shifted X, (1,1,1) might separate them if shift is large enough.

    // We need the separating axis to be strictly an edge cross product.
    // Edge of A: (1,1,1) to (1,-1,-1) -> (0, -2, -2) -> (0, 1, 1).
    // Edge of B: ...

    // Let's assume for now that creating two random brushes close to each other might trigger it.
    // But to be deterministic:
    // Use the "Minkowski Sum" idea.
    // Actually, simple test:
    // Construct two brushes that DO NOT overlap, but are reported as overlapping by current validation.
    // I'll create a scenario with `createRotatedBox`.
    // Box 1: 2x2x2 at origin. Rotated 45 X, 45 Y.
    // Box 2: 2x2x2 at (2.5, 0, 0). Rotated 0.

    // Let's perform the test.
    const b1 = createRotatedBox({x:0, y:0, z:0}, {x:2, y:2, z:2}, Math.PI/4, Math.PI/4);
    const b2 = createRotatedBox({x:2.8, y:0, z:0}, {x:2, y:2, z:2}, 0, 0);
    // Distance 2.8. Radii approx 1.73 (sqrt(3)).
    // They might overlap AABBs.

    // Let's verify if `validateCsgResult` thinks they overlap.
    // If they don't overlap in reality but validation says yes, then we have a repro.
    // If validation says no (correctly), then face normals were enough.

    // I'll add this test file and run it to see.
    // I expect it to FAIL (validation says valid=false, overlap detected) if my hypothesis about face normals being insufficient for this case is true.
    // If it passes (valid=true), then face normals separated them.

    // Note: I want a case where they ARE separated, but validation says OVERLAP.
    // So expect(result.valid).toBe(true).

    const result = validateCsgResult([], [b1, b2]);

    // With current code (only face normals), it might return false (overlap) if face normals don't separate.
    // With fix, it should return true (valid).

    expect(result.valid).toBe(true);
  });
});
