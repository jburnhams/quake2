import { describe, it, expect } from 'vitest';
import {
  type Bounds3,
  createEmptyBounds3,
  windingBounds,
  createWinding,
  baseWindingForPlane,
  chopWindingByPlanes,
  windingPlane
} from '@quake2ts/shared';
import { validateCsgResult } from '../../../src/compiler/validation';
import type { CompileBrush, CompileSide, MapBrush } from '../../../src/types/compile';

// Helper to create a simple box brush
function createBoxBrush(mins: number[], maxs: number[]): CompileBrush {
  const sides: CompileSide[] = [];
  const planes = [
    { normal: { x: 1, y: 0, z: 0 }, dist: maxs[0] },
    { normal: { x: -1, y: 0, z: 0 }, dist: -mins[0] },
    { normal: { x: 0, y: 1, z: 0 }, dist: maxs[1] },
    { normal: { x: 0, y: -1, z: 0 }, dist: -mins[1] },
    { normal: { x: 0, y: 0, z: 1 }, dist: maxs[2] },
    { normal: { x: 0, y: 0, z: -1 }, dist: -mins[2] }
  ];

  for (let i = 0; i < planes.length; i++) {
    const p = planes[i];
    let w = baseWindingForPlane(p.normal, p.dist);

    if (!w) {
      console.error('baseWindingForPlane returned null/undefined for', p);
    }

    // Chop by other planes
    for (let j = 0; j < planes.length; j++) {
      if (i === j) continue;
      const other = planes[j];
      // Chop keeps INSIDE (back side of plane).
      // Brush is intersection of half-spaces defined by planes pointing OUT.
      // So keep back side of other planes.
      // baseWindingForPlane creates winding on the plane.
      // We need to chop it by OTHER planes of the brush to form the face polygon.

      // chopWindingByPlanes implementation:
      // It iterates planes and calls clipWindingEpsilon(w, p.normal, p.dist, eps, false).
      // This keeps BACK side. Correct.

      // However, we need to pass just one plane at a time or array?
      // chopWindingByPlanes takes array.
      // Here we just clip against ONE plane at a time manually or construct array.
      // Let's use array of others.
      // Iterate manually to avoid passing array if chopWindingByPlanes is suspect
      // But chopWindingByPlanes expects array.
      // Let's debug w.
    }

    // Use the bulk chop
    const clipPlanes = planes.filter((_, idx) => idx !== i);
    w = chopWindingByPlanes(w, clipPlanes)!;

    if (w) {
      sides.push({
        planeNum: i, // Dummy index
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
  // Using side windings
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

describe('validateCsgResult', () => {
  it('validates disjoint brushes as valid', () => {
    // Box 1: 0,0,0 to 10,10,10
    const b1 = createBoxBrush([0,0,0], [10,10,10]);
    // Box 2: 20,0,0 to 30,10,10
    const b2 = createBoxBrush([20,0,0], [30,10,10]);

    const result = validateCsgResult([], [b1, b2]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates touching brushes as valid', () => {
    // Box 1: 0,0,0 to 10,10,10
    const b1 = createBoxBrush([0,0,0], [10,10,10]);
    // Box 2: 10,0,0 to 20,10,10 (touches at x=10)
    const b2 = createBoxBrush([10,0,0], [20,10,10]);

    const result = validateCsgResult([], [b1, b2]);
    expect(result.valid).toBe(true);
  });

  it('detects overlapping brushes', () => {
    // Box 1: 0,0,0 to 10,10,10
    const b1 = createBoxBrush([0,0,0], [10,10,10]);
    // Box 2: 5,5,5 to 15,15,15 (overlaps)
    const b2 = createBoxBrush([5,5,5], [15,15,15]);

    const result = validateCsgResult([], [b1, b2]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('overlap');
  });

  it('detects degenerate brushes (missing sides)', () => {
    const b = createBoxBrush([0,0,0], [10,10,10]);
    // Make it invalid by removing sides
    b.sides = [];

    const result = validateCsgResult([], [b]);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('invalid');
  });

  it('detects degenerate brushes (negative volume)', () => {
    // Zero volume?
    const b = createBoxBrush([0,0,0], [0,0,0]); // Point?
    // createBoxBrush might fail to create sides for 0 volume if planes coincide.
    // Let's force bounds to be bad.
    b.bounds.mins.x = 10;
    b.bounds.maxs.x = 0;

    const result = validateCsgResult([], [b]);
    expect(result.valid).toBe(false);
  });
});
