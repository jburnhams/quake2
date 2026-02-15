import { describe, it, expect } from 'vitest';
import {
  splitBrush,
  calculateBounds,
  createBrushList,
  addBrush,
  countBrushes,
  freeBrushList,
  subtractBrush,
  processCsg
} from '../../../src/compiler/csg.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { createEmptyBounds3 } from '@quake2ts/shared';
import { createCompileBrush } from '@quake2ts/test-utils';
import type { CompileBrush } from '../../../src/types/compile.js';

describe('splitBrush', () => {
  it('splits a box by an axial plane', () => {
    const planeSet = new PlaneSet();
    const b = box({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 128, y: 128, z: 128 },
      contents: 1
    });
    const brush = createCompileBrush(b, planeSet);

    // Split by X=0 plane
    const splitNormal = { x: 1, y: 0, z: 0 };
    const splitDist = 0;
    const splitIdx = planeSet.findOrAdd(splitNormal, splitDist);
    const splitPlane = planeSet.getPlanes()[splitIdx];

    const result = splitBrush(brush, splitIdx, splitPlane, planeSet);

    expect(result.front).not.toBeNull();
    expect(result.back).not.toBeNull();

    // Front brush should be on X > 0
    expect(result.front!.bounds.mins.x).toBeGreaterThanOrEqual(-0.001);
    expect(result.front!.bounds.maxs.x).toBeCloseTo(64);

    // Back brush should be on X < 0
    expect(result.back!.bounds.maxs.x).toBeLessThanOrEqual(0.001);
    expect(result.back!.bounds.mins.x).toBeCloseTo(-64);
  });

  it('returns only back when brush is fully behind plane', () => {
    const planeSet = new PlaneSet();
    const b = box({
      origin: { x: -100, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 }, // x range: -132 to -68
      contents: 1
    });
    const brush = createCompileBrush(b, planeSet);

    // Split by X=0
    const splitNormal = { x: 1, y: 0, z: 0 };
    const splitDist = 0;
    const splitIdx = planeSet.findOrAdd(splitNormal, splitDist);
    const splitPlane = planeSet.getPlanes()[splitIdx];

    const result = splitBrush(brush, splitIdx, splitPlane, planeSet);

    expect(result.front).toBeNull();
    expect(result.back).not.toBeNull();
    // In current implementation, if front is empty, we return back: brush (same object reference)
    expect(result.back).toBe(brush);
  });

  it('returns only front when brush is fully in front of plane', () => {
    const planeSet = new PlaneSet();
    const b = box({
      origin: { x: 100, y: 0, z: 0 },
      size: { x: 64, y: 64, z: 64 }, // x range: 68 to 132
      contents: 1
    });
    const brush = createCompileBrush(b, planeSet);

    // Split by X=0
    const splitNormal = { x: 1, y: 0, z: 0 };
    const splitDist = 0;
    const splitIdx = planeSet.findOrAdd(splitNormal, splitDist);
    const splitPlane = planeSet.getPlanes()[splitIdx];

    const result = splitBrush(brush, splitIdx, splitPlane, planeSet);

    expect(result.front).not.toBeNull();
    expect(result.back).toBeNull();
    expect(result.front).toBe(brush);
  });

  it('splits a box by a corner plane', () => {
    const planeSet = new PlaneSet();
    const b = box({
      origin: { x: 0, y: 0, z: 0 },
      size: { x: 128, y: 128, z: 128 },
      contents: 1
    });
    const brush = createCompileBrush(b, planeSet);

    // Split by diagonal plane (X+Y > some value)
    // Normal = (1, 1, 0) normalized
    const len = Math.sqrt(2);
    const splitNormal = { x: 1 / len, y: 1 / len, z: 0 };
    // Box max extent in this direction is 64/len + 64/len = 128/len = 64*sqrt(2) ≈ 90.5
    // Set distance to 80, so we cut off the corner at (64, 64)
    const splitDist = 80;

    const splitIdx = planeSet.findOrAdd(splitNormal, splitDist);
    const splitPlane = planeSet.getPlanes()[splitIdx];

    const result = splitBrush(brush, splitIdx, splitPlane, planeSet);

    expect(result.front).not.toBeNull();
    expect(result.back).not.toBeNull();

    // Front brush is the small corner piece
    // Its bounds should be near the corner (64, 64)
    expect(result.front!.bounds.maxs.x).toBeCloseTo(64);
    expect(result.front!.bounds.maxs.y).toBeCloseTo(64);
    // It should be bounded by split plane on one side (mins side relative to normal)

    // Back brush is the large remaining piece
    // It should contain the opposite corner (-64, -64)
    expect(result.back!.bounds.mins.x).toBeCloseTo(-64);
    expect(result.back!.bounds.mins.y).toBeCloseTo(-64);
  });
});

describe('BrushList', () => {
  // Helper to create a dummy brush
  function createDummyBrush(): CompileBrush {
    return {
      original: {} as any,
      sides: [],
      bounds: createEmptyBounds3(),
      next: null
    };
  }

  it('creates an empty list', () => {
    const list = createBrushList();
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.count).toBe(0);
  });

  it('adds brushes to list', () => {
    const list = createBrushList();
    const b1 = createDummyBrush();
    const b2 = createDummyBrush();

    addBrush(list, b1);
    expect(list.head).toBe(b1);
    expect(list.tail).toBe(b1);
    expect(list.count).toBe(1);

    addBrush(list, b2);
    expect(list.head).toBe(b1);
    expect(list.head!.next).toBe(b2);
    expect(list.tail).toBe(b2);
    expect(list.count).toBe(2);
  });

  it('counts brushes correctly', () => {
    const list = createBrushList();
    addBrush(list, createDummyBrush());
    addBrush(list, createDummyBrush());
    addBrush(list, createDummyBrush());
    expect(countBrushes(list)).toBe(3);
    expect(list.count).toBe(3);
  });

  it('frees brush list', () => {
    const list = createBrushList();
    addBrush(list, createDummyBrush());
    freeBrushList(list);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.count).toBe(0);
  });
});

describe('subtractBrush', () => {
  it('returns original brush when non-overlapping', () => {
    const planeSet = new PlaneSet();
    // Box at origin
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushA = createCompileBrush(b1, planeSet);

    // Box far away
    const b2 = box({ origin: { x: 200, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = subtractBrush(brushA, brushB, planeSet);

    // Should return A (or equivalent)
    expect(result).toBe(brushA);
    expect(result!.next).toBeNull();
  });

  it('returns null when A is entirely inside B', () => {
    const planeSet = new PlaneSet();
    // Small box inside
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 32, y: 32, z: 32 } });
    const brushA = createCompileBrush(b1, planeSet);

    // Large box outside
    const b2 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = subtractBrush(brushA, brushB, planeSet);

    expect(result).toBeNull();
  });

  it('carves A when it partially overlaps B', () => {
    const planeSet = new PlaneSet();
    // Box A: -32 to 32
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushA = createCompileBrush(b1, planeSet);

    // Box B: 16 to 80 (overlaps A on positive side)
    const b2 = box({ origin: { x: 48, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = subtractBrush(brushA, brushB, planeSet);

    expect(result).not.toBeNull();

    // Count fragments
    let count = 0;
    let curr = result;
    while (curr) {
      count++;
      curr = curr.next || null;
    }

    expect(count).toBeGreaterThanOrEqual(1);

    // Verify bounds of the first fragment
    expect(result!.bounds.maxs.x).toBeCloseTo(16);
    expect(result!.bounds.mins.x).toBeCloseTo(-32);
  });
});

describe('processCsg', () => {
  it('handles two non-overlapping brushes', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 32, y: 32, z: 32 } });
    const brushA = createCompileBrush(b1, planeSet);
    const b2 = box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 32, y: 32, z: 32 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = processCsg([brushA, brushB], planeSet);

    expect(result.length).toBe(2);
    // Since non-overlapping, structure should be preserved (though objects might be cloned)
    expect(result[0].bounds.mins.x).toBeCloseTo(-16);
    expect(result[1].bounds.mins.x).toBeCloseTo(84);
  });

  it('subtracts overlapping brush (B cuts A)', () => {
    const planeSet = new PlaneSet();
    // A: -32 to 32
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushA = createCompileBrush(b1, planeSet);

    // B: 16 to 80 (overlaps A)
    const b2 = box({ origin: { x: 48, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet);

    // processCsg([A, B]) -> A is cut by B, B is added.
    const result = processCsg([brushA, brushB], planeSet);

    // B should remain intact
    const outB = result[result.length - 1];
    expect(outB.bounds.mins.x).toBeCloseTo(16);
    expect(outB.bounds.maxs.x).toBeCloseTo(80);

    // A should be cut. The part of A inside B (16 to 32) is removed.
    // Remaining A should be -32 to 16.
    // CSG might produce multiple fragments, but the bounding box of the remaining parts should be within -32 to 16.

    // Find fragments that came from A
    const fragmentsA = result.filter(b => b !== outB);
    expect(fragmentsA.length).toBeGreaterThan(0);

    for (const f of fragmentsA) {
        // All fragments of A should be outside B
        // B starts at 16. So fragments should be < 16 (or other dimensions non-overlapping)
        // Check X max
        // Wait, if splitting happens, bounds are tight.
        // The fragment that was adjacent to B should end at 16.
        if (f.bounds.mins.x > -32 && f.bounds.maxs.x < 32) {
             expect(f.bounds.maxs.x).toBeLessThanOrEqual(16.001);
        }
    }
  });

  it('removes brush A if fully inside B', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 32, y: 32, z: 32 } });
    const brushA = createCompileBrush(b1, planeSet);

    const b2 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = processCsg([brushA, brushB], planeSet);

    // Only B should remain
    expect(result.length).toBe(1);
    expect(result[0].bounds.maxs.x).toBeCloseTo(32); // brushB
  });

  it('hollows out A if B is inside A (A - B)', () => {
    const planeSet = new PlaneSet();
    // A: large box
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 128, y: 128, z: 128 } });
    const brushA = createCompileBrush(b1, planeSet);

    // B: small box inside
    const b2 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 32, y: 32, z: 32 } });
    const brushB = createCompileBrush(b2, planeSet);

    const result = processCsg([brushA, brushB], planeSet);

    // B remains
    const outB = result[result.length - 1];
    expect(outB.bounds.maxs.x).toBeCloseTo(16);

    // A should be fragmented into pieces surrounding B
    // A was -64 to 64. B is -16 to 16.
    // Fragments should cover the volume of A minus B.
    expect(result.length).toBeGreaterThan(1);
  });

  it('preserves detail brushes if configured', () => {
    const planeSet = new PlaneSet();
    const CONTENTS_DETAIL = 0x8000000;

    // A: Structural brush
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushA = createCompileBrush(b1, planeSet); // contents=1 by default

    // B: Detail brush overlapping A
    const b2 = box({ origin: { x: 48, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brushB = createCompileBrush(b2, planeSet, CONTENTS_DETAIL);

    // processCsg with preserveDetail=true
    // B is detail, A is structural.
    // B should NOT cut A.
    const result = processCsg([brushA, brushB], planeSet, { preserveDetail: true });

    // Both brushes should remain intact (conceptually)
    // Actually, A should remain intact (not cut). B is added.
    // So output count is 2.
    expect(result.length).toBe(2);

    // Verify A is still full size (-32 to 32)
    // Find structural brush
    const outA = result.find(b => (b.original.contents & CONTENTS_DETAIL) === 0);
    expect(outA).toBeDefined();
    expect(outA!.bounds.maxs.x).toBeCloseTo(32);
    expect(outA!.bounds.mins.x).toBeCloseTo(-32);
  });
});
