import { describe, expect, it } from 'vitest';
import { traceBox } from '../../src/bsp/collision.js';
import { makeAxisBrush, makeLeafModel } from './test-helpers.js';

describe('traceBox simple cases', () => {
  it('should not collide with anything if the path is clear', () => {
    const brush = makeAxisBrush(64); // A 64x64x64 box at the origin
    const model = makeLeafModel([brush]);

    // A trace that starts and ends far away from the brush
    const start = { x: -128, y: 0, z: 0 };
    const end = { x: -96, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    expect(result.fraction).toBe(1);
    expect(result.startsolid).toBe(false);
    expect(result.allsolid).toBe(false);
    expect(result.endpos).toEqual(end);
  });

  it('should collide with a single axis-aligned plane', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A trace that starts outside and moves towards the brush
    const start = { x: -64, y: 0, z: 0 };
    const end = { x: 64, y: 0, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    // The brush extends from -32 to 32 on the x-axis.
    // The trace starts at -64 and moves towards 64.
    // The total travel distance is 128.
    // The collision should happen at x = -32.
    // The distance from the start to the collision point is 32.
    // However, the engine pushes the collision back by DIST_EPSILON.
    const expectedFraction = (32 - 0.03125) / 128;

    expect(result.fraction).toBeCloseTo(expectedFraction);
    expect(result.startsolid).toBe(false);
    expect(result.allsolid).toBe(false);
    expect(result.endpos.x).toBeCloseTo(-32.03125);
    expect(result.endpos.y).toBe(0);
    expect(result.endpos.z).toBe(0);
  });

  it('should collide with the nearest plane of a convex brush', () => {
    const brush = makeAxisBrush(64);
    const model = makeLeafModel([brush]);

    // A trace that starts outside and moves towards the brush from an angle,
    // so it could potentially hit multiple planes.
    const start = { x: -64, y: -64, z: 0 };
    const end = { x: 64, y: 64, z: 0 };

    const result = traceBox({ model, start, end, headnode: -1 });

    // The trace will hit the x-plane at x=-32 and the y-plane at y=-32.
    // Since the start point is equidistant from both planes, the trace
    // will hit both at the same time. The tie-breaking behavior in this
    // case is not strictly defined, but we expect it to collide with one of them.
    // The fraction will be the same for both.
    const expectedFraction = (32 - 0.03125) / 128;

    expect(result.fraction).toBeCloseTo(expectedFraction);
    expect(result.startsolid).toBe(false);
    expect(result.allsolid).toBe(false);
  });
});
