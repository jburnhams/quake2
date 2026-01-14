import { describe, expect, it } from 'vitest';
import { DIST_EPSILON, traceBox } from '../../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';

describe('traceBox epsilon and grazing cases', () => {
  it('should stop exactly DIST_EPSILON away from a collision plane', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    const start = { x: -64, y: 0, z: 0 };
    const end = { x: 0, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    // The collision plane is at x = -32.
    // The total travel distance is 64.
    // The distance to the plane is 32.
    const travel = end.x - start.x;
    const distToPlane = -32 - start.x;

    // The fraction should be calculated based on the position DIST_EPSILON
    // away from the plane, not the plane itself.
    const expectedFraction = (distToPlane - DIST_EPSILON) / travel;

    expect(result.fraction).toBeCloseTo(expectedFraction);
    expect(result.endpos.x).toBeCloseTo(start.x + (travel * expectedFraction));
  });

  it('should collide with side plane when grazing exactly on a surface', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A trace that runs exactly parallel to the top surface of the brush (z = 32)
    const start = { x: -64, y: 0, z: 32 };
    const end = { x: 64, y: 0, z: 32 };

    const result = traceBox({ model, start, end, headnode: -1 });

    // Because the trace is exactly on the top plane, it is considered "inside"
    // that plane. The trace proceeds and collides with the side plane at x=-32.
    const travel = end.x - start.x; // 128
    const distToPlane = -32 - start.x; // 32
    const expectedFraction = (distToPlane - DIST_EPSILON) / travel;

    expect(result.fraction).toBeCloseTo(expectedFraction);
  });
});
