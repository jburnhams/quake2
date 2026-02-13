import { describe, it, expect } from 'vitest';
import { splitBrush } from '../../../src/compiler/csg.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { generateBrushWindings } from '../../../src/compiler/brushProcessing.js';
import { windingBounds, createEmptyBounds3 } from '@quake2ts/shared';
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

    const mapBrush: MapBrush = {
        entityNum: 0,
        brushNum: 0,
        sides,
        bounds: createEmptyBounds3(),
        contents: 1
    };

    // Calculate bounds
    let bounds = createEmptyBounds3();
    let first = true;
    for (const side of sides) {
        if (side.winding) {
            const wb = windingBounds(side.winding);
             if (first) {
                bounds = wb;
                first = false;
            } else {
                bounds = {
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
            }
        }
    }
    mapBrush.bounds = bounds;

    return {
        original: mapBrush,
        sides,
        bounds
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
    // Wait, let's verify if my implementation returns the same object or creates a copy.
    // "if (frontSides.length === 0) { return { front: null, back: brush }; }"
    // So it returns the same brush object.
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
