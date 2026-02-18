import { describe, it, expect } from 'vitest';
import {
  type Bounds3,
  createEmptyBounds3,
  baseWindingForPlane,
  chopWindingByPlanes,
  windingBounds,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import {
  processCsg,
  subtractBrush
} from '../../src/compiler/csg';
import {
  PlaneSet
} from '../../src/compiler/planes';
import {
  validateCsgResult
} from '../../src/compiler/validation';
import type { CompileBrush, CompileSide, MapBrush } from '../../src/types/compile';

// Helper to create a box brush
function createBox(mins: number[], maxs: number[], planeSet: PlaneSet, contents: number = CONTENTS_SOLID): CompileBrush {
  const sides: CompileSide[] = [];
  const planes = [
    { normal: { x: 1, y: 0, z: 0 }, dist: maxs[0] },
    { normal: { x: -1, y: 0, z: 0 }, dist: -mins[0] },
    { normal: { x: 0, y: 1, z: 0 }, dist: maxs[1] },
    { normal: { x: 0, y: -1, z: 0 }, dist: -mins[1] },
    { normal: { x: 0, y: 0, z: 1 }, dist: maxs[2] },
    { normal: { x: 0, y: 0, z: -1 }, dist: -mins[2] }
  ];

  for (const p of planes) {
    // Add to plane set
    const planeNum = planeSet.findOrAdd(p.normal, p.dist);

    // Create winding
    let w = baseWindingForPlane(p.normal, p.dist);
    const clipPlanes = planes.filter(cp => cp !== p);
    w = chopWindingByPlanes(w, clipPlanes)!;

    if (w) {
      sides.push({
        planeNum,
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
    original: { contents } as MapBrush,
    sides,
    bounds,
    next: null
  };
}

describe('CSG Integration', () => {
  it('correctly processes disjoint brushes', () => {
    const planeSet = new PlaneSet();
    const b1 = createBox([0,0,0], [10,10,10], planeSet);
    const b2 = createBox([20,0,0], [30,10,10], planeSet);

    const result = processCsg([b1, b2], planeSet);

    expect(result.length).toBe(2);

    const validation = validateCsgResult([b1, b2], result);
    expect(validation.valid).toBe(true);
  });

  it('subtracts a small box from a larger box', () => {
    const planeSet = new PlaneSet();
    // Large box
    const outer = createBox([0,0,0], [100,100,100], planeSet);
    // Small box inside (centered)
    const inner = createBox([40,40,40], [60,60,60], planeSet);

    // Standard CSG:
    // If we want to subtract inner from outer (hollow box), we perform subtraction.
    // processCsg performs union of solid brushes.
    // So if we pass both, the result is the union (outer swallows inner).
    // Result should be just outer?
    // Wait. processCsg logic:
    // Iterate brushes. New brush subtracts from existing.
    // Brushes: [outer, inner].
    // 1. Add outer. List: [outer].
    // 2. Process inner. Subtract inner from outer? No.
    // Logic: `subtractBrush(current, brush)`.
    // Current is outer. Brush is inner.
    // Subtract inner from outer.
    // Result is outer with a hole?
    // Wait. If both are solid, the union is just outer.
    // But `subtractBrush(a, b)` returns `a - b`.
    // So if inner is inside outer, `outer - inner` is outer with a hole.
    // And we add `inner` back to the list.
    // So final result is `(outer - inner) + inner`.
    // Which is disjoint union partitioning the space.
    // Correct.

    const result = processCsg([outer, inner], planeSet);

    // Outer should be fragmented into pieces surrounding inner.
    // Inner should remain as one piece.
    // Total result count > 2.

    // How many pieces for a box cut out of a box?
    // Inner box has 6 planes. Each plane splits outer.
    // Can be up to 6 splits.

    expect(result.length).toBeGreaterThan(2);

    // Validate
    const validation = validateCsgResult([outer, inner], result);
    expect(validation.valid).toBe(true);

    // Check for overlap
    // If logic is correct, no overlap.
  });

  it('subtracts overlapping box (corner cut)', () => {
    const planeSet = new PlaneSet();
    const b1 = createBox([0,0,0], [10,10,10], planeSet);
    const b2 = createBox([5,5,5], [15,15,15], planeSet); // Overlaps corner

    const result = processCsg([b1, b2], planeSet);

    // b1 should be cut by b2. b2 added whole.
    // b1 - b2 + b2.
    // b1 fragment should be the part 0,0,0 to 5,5,5 (and other parts).

    expect(result.length).toBeGreaterThan(1);

    const validation = validateCsgResult([b1, b2], result);
    expect(validation.valid).toBe(true);
  });
});
