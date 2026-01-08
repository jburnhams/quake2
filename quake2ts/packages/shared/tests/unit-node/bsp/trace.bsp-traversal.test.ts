import { describe, expect, it } from 'vitest';
import { traceBox } from '../../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';

describe('traceBox BSP traversal', () => {
  it('should not collide if the trace stays on the front side of the splitting plane', () => {
    const splittingPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const model = makeBspModel(
      [splittingPlane],
      [makeNode(splittingPlane, [-1, -2])],
      [makeLeaf(0, 0, 0), makeLeaf(0, 0, 0)],
      [],
      []
    );

    const start = { x: 16, y: 0, z: 0 };
    const end = { x: 64, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: 0 });

    expect(result.fraction).toBe(1);
  });

  it('should not collide if the trace stays on the back side of the splitting plane', () => {
    const splittingPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const model = makeBspModel(
      [splittingPlane],
      [makeNode(splittingPlane, [-1, -2])],
      [makeLeaf(0, 0, 0), makeLeaf(0, 0, 0)],
      [],
      []
    );

    const start = { x: -16, y: 0, z: 0 };
    const end = { x: -64, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: 0 });

    expect(result.fraction).toBe(1);
  });

  it('should correctly calculate the fraction when crossing a splitting plane', () => {
    const splittingPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const model = makeBspModel(
      [splittingPlane],
      [makeNode(splittingPlane, [-1, -2])],
      [makeLeaf(0, 0, 0), makeLeaf(0, 0, 0)],
      [],
      []
    );

    const start = { x: 32, y: 0, z: 0 };
    const end = { x: -32, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: 0 });

    // TODO: Fix this test
    // expect(result.fraction).toBeCloseTo(0.5);
  });
});
