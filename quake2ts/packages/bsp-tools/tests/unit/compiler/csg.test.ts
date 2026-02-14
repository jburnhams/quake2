import { describe, it, expect } from 'vitest';
import {
  splitBrush,
  calculateBounds,
  createBrushList,
  addBrush,
  countBrushes,
  freeBrushList,
  subtractBrush
} from '../../../src/compiler/csg.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { generateBrushWindings } from '../../../src/compiler/brushProcessing.js';
import { createEmptyBounds3 } from '@quake2ts/shared';
import type { CompileBrush, CompileSide, MapBrush } from '../../../src/types/compile.js';

describe('splitBrush', () => {
  // Helper to create CompileBrush from BrushDef
  function createCompileBrush(def: ReturnType<typeof box>, planeSet: PlaneSet): CompileBrush {
    const windings = generateBrushWindings(def);
    const sides: CompileSide[] = [];

    // Add planes to PlaneSet and create sides
    def.sides.forEach((s, i) => {
        const planeNum = planeSet.findOrAdd(s.plane.normal, s.plane.dist);
        sides.push({
            planeNum,
            texInfo: 0,
            winding: windings.get(i),
            visible: true,
            tested: false,
            bevel: false
        });
    });

    const bounds = calculateBounds(sides);

    const mapBrush: MapBrush = {
        entityNum: 0,
        brushNum: 0,
        sides,
        bounds,
        contents: 1
    };

    return {
        original: mapBrush,
        sides,
        bounds,
        next: null
    };
  }

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
  // Reuse createCompileBrush from splitBrush tests
  function createCompileBrush(def: ReturnType<typeof box>, planeSet: PlaneSet): CompileBrush {
    const windings = generateBrushWindings(def);
    const sides: CompileSide[] = [];
    def.sides.forEach((s, i) => {
        const planeNum = planeSet.findOrAdd(s.plane.normal, s.plane.dist);
        sides.push({
            planeNum,
            texInfo: 0,
            winding: windings.get(i),
            visible: true,
            tested: false,
            bevel: false
        });
    });
    const bounds = calculateBounds(sides);
    const mapBrush: MapBrush = { entityNum: 0, brushNum: 0, sides, bounds, contents: 1 };
    return { original: mapBrush, sides, bounds, next: null };
  }

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
