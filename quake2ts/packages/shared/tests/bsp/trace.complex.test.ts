import { describe, expect, it } from 'vitest';
import { traceBox } from '../../src/bsp/collision.js';
import {
  makeLeafModel,
  makeBrushFromMinsMaxs,
  makeAxisBrush,
  makeBspModel,
  makeLeaf,
  makeNode,
  makePlane,
} from './test-helpers.js';

describe('traceBox complex geometry cases', () => {
  it('should collide with an internal corner', () => {
    // Create an L-shaped corner by combining two brushes
    const brush1 = makeBrushFromMinsMaxs({ x: -64, y: -64, z: -32 }, { x: 0, y: 64, z: 32 });
    const brush2 = makeBrushFromMinsMaxs({ x: -64, y: -64, z: -32 }, { x: 64, y: 0, z: 32 });
    const model = makeLeafModel([brush1, brush2]);

    // A trace starting outside the corner, heading directly into it
    const start = { x: 32, y: 32, z: 0 };
    const end = { x: -32, y: -32, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    // The trace should collide with the internal corner at (0, 0, 0)
    // The trace collides with the y-plane of brush1 at y=0, and the x-plane
    // of brush2 at x=0. The collision point is (0,0,0).
    const travel = start.x - end.x; // 64
    const distToPlane = start.x; // 32
    const expectedFraction = (distToPlane - 0.03125) / travel;

    expect(result.fraction).toBeCloseTo(expectedFraction);
    // The endpos should be pushed back along the trace vector
    const expectedX = start.x + (end.x - start.x) * expectedFraction;
    const expectedY = start.y + (end.y - start.y) * expectedFraction;
    expect(result.endpos.x).toBeCloseTo(expectedX);
    expect(result.endpos.y).toBeCloseTo(expectedY);
  });

  it('should correctly traverse a BSP node to find a collision', () => {
    // Create a splitting plane at x=0
    const splittingPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);

    // Create a brush that will be in the back leaf
    const brush = makeBrushFromMinsMaxs({ x: -64, y: -32, z: -32 }, { x: -32, y: 32, z: 32 });

    // Create a simple BSP tree with one node and two leaves.
    // The front leaf (positive x) is empty.
    // The back leaf (negative x) contains the brush.
    const model = makeBspModel(
      [splittingPlane],
      [makeNode(splittingPlane, [-1, -2])], // children are leaf indices, negated and decremented
      [makeLeaf(0, 0, 0), makeLeaf(0, 0, 1)], // leaf 0 is empty, leaf 1 has 1 brush
      [brush],
      [0] // leafBrushes maps leaf 1 to brush 0
    );

    // A trace that starts in the empty front leaf and crosses the splitting plane
    // into the back leaf, where it should collide with the brush.
    const start = { x: 32, y: 0, z: 0 };
    const end = { x: -48, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: 0 });

    expect(result.fraction).toBeLessThan(1);
    // Trace stops DIST_EPSILON (0.03125) before hitting the surface at x=-32
    expect(result.endpos.x).toBeCloseTo(-31.96875);
  });
});
