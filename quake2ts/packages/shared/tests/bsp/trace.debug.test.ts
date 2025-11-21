import { describe, expect, it } from 'vitest';
import { traceBox } from '../../src/bsp/collision.js';
import { makeBspModel, makeLeaf, makeNode, makePlane, makeBrushFromMinsMaxs } from './test-helpers.js';

describe('traceBox debugging', () => {
  it('should handle a simple BSP traversal', () => {
    const splittingPlane = makePlane({ x: 1, y: 0, z: 0 }, 0);
    const brush = makeBrushFromMinsMaxs({ x: -64, y: -32, z: -32 }, { x: -32, y: 32, z: 32 });
    const model = makeBspModel(
      [splittingPlane],
      [makeNode(splittingPlane, [-1, -2])],
      [makeLeaf(0, 0, 0), makeLeaf(0, 0, 1)],
      [brush],
      [0]
    );

    const start = { x: 32, y: 0, z: 0 };
    const end = { x: -48, y: 0, z: 0 };

    console.log('--- TEST ---');
    console.log('start', start);
    console.log('end', end);

    const result = traceBox({ model, start, end, headnode: 0 });

    console.log('--- RESULT ---');
    console.log('result', result);

    expect(result.fraction).toBeLessThan(1);
    // Trace stops DIST_EPSILON (0.03125) before hitting the surface at x=-32
    expect(result.endpos.x).toBeCloseTo(-31.96875);
  });
});
