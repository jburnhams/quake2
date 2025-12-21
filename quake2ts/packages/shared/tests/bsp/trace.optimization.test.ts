import { describe, expect, it } from 'vitest';
import { traceBox, computePlaneSignBits } from '../../src/bsp/collision.js';
import { makeBrushFromMinsMaxs, makeLeaf, makePlane, makeNode, makeBspModel, makeAxisBrush, makeLeafModel } from '@quake2ts/test-utils';
import { CONTENTS_SOLID } from '../../src/bsp/contents.js';

describe('Trace Optimization', () => {
  it('should early-out when trace is blocked (hit first wall, ignore second)', () => {
    // Create two walls.
    // Wall 1: x=100 to x=110 (blocking)
    // Wall 2: x=200 to x=210 (behind wall 1)
    const wall1 = makeBrushFromMinsMaxs({ x: 100, y: -50, z: -50 }, { x: 110, y: 50, z: 50 });
    const wall2 = makeBrushFromMinsMaxs({ x: 200, y: -50, z: -50 }, { x: 210, y: 50, z: 50 });

    // Since we can't easily spy on internal functions without mocking,
    // we verify the result is correct (hits wall 1) and rely on code inspection
    // for the "optimization" part, OR we can check if the existence of wall 2 matters.

    // Let's put them in a simple leaf first to establish baseline
    const brushes = [wall1, wall2];
    // To test optimization we need a BSP structure.
    // Plane splitting at x=150.
    // Child 0 (front): > 150 -> contains wall 2
    // Child 1 (back): < 150 -> contains wall 1

    const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 150);

    const nodes = [
      makeNode(splitPlane, [-1, -2]) // -1 is leaf 0 (front), -2 is leaf 1 (back)
    ];

    // Leaf 0: Front of plane (x > 150), contains wall 2
    const leaf0 = makeLeaf(0, 0, 1); // brush index 0 -> wall 2? No, let's be careful with indices.

    // Leaf 1: Back of plane (x < 150), contains wall 1
    const leaf1 = makeLeaf(0, 1, 1); // brush index 1 -> wall 1?

    // We need to set up leafBrushes correctly.
    // leafBrushes array: [index of wall2, index of wall1]
    // Wait, standard is usually sequential.

    // Let's say:
    // brush[0] = wall2
    // brush[1] = wall1

    const leafBrushes = [0, 1];

    const model = makeBspModel(
      [splitPlane, ...wall1.sides.map(s => s.plane), ...wall2.sides.map(s => s.plane)],
      nodes,
      [leaf0, leaf1], // leaf 0 (front), leaf 1 (back)
      [wall2, wall1], // brushes
      leafBrushes
    );

    // Trace from 0 to 300.
    // Should hit wall 1 at 100.
    // Should NOT traverse into leaf 0 (x > 150) because it hits before the split?
    // Actually, trace goes 0 -> 300.
    // Split is at 150.
    // recursiveHullCheck will:
    // 1. Check dists against split plane. Start=0 (back), End=300 (front).
    // 2. Traverse back side (child 1, leaf 1) first.
    // 3. In leaf 1, hit wall 1. Trace fraction becomes ~0.33.
    // 4. Return to split node.
    // 5. updatedFraction (0.33) <= midFraction (0.5). midFraction is intersection with split plane (150).
    // 6. Should RETURN and NOT traverse front side (child 0, leaf 0).

    // We can verify this by adding a "poison" brush in leaf 0 that would block the trace EARLIER if it were checked.
    // If we put a brush at x=50 in leaf 0 (physically impossible for valid BSP, but possible data),
    // checking it would yield a closer hit.
    // BUT, geometry in leaf 0 MUST be in x > 150 space for valid BSP.

    // So let's trust the checkcount or just verify correct hit.
    // To truly verify optimization, we can use the "poison" trick:
    // Put a brush in leaf 0 that is actually at x=50 (violating BSP rules).
    // If the code optimizes, it should never check leaf 0, so it won't see the poison brush.
    // If it fails to optimize (checks everything), it might see the poison brush and return a hit at 50.

    const poisonBrush = makeBrushFromMinsMaxs({ x: 50, y: -50, z: -50 }, { x: 60, y: 50, z: 50 });

    // Rebuild model with poison brush in the "far" leaf.
    // Node split at 150.
    // Near leaf (back): wall 1 (100-110)
    // Far leaf (front): poison brush (50-60) -- this is spatially wrong for the leaf, but perfect for testing traversal logic.

    const modelWithPoison = makeBspModel(
      [splitPlane],
      nodes,
      [leaf0, leaf1],
      [poisonBrush, wall1], // brush 0 = poison, brush 1 = wall 1
      [0, 1] // leaf 0 has brush 0, leaf 1 has brush 1
    );

    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 300, y: 0, z: 0 };

    const result = traceBox({ model: modelWithPoison, start, end });

    // If optimization works:
    // 1. Recursion goes to back side (leaf 1) -> hits wall 1 at x=100. Fraction ~0.33.
    // 2. Returns to node. Fraction (0.33) < midFraction (at x=150, fraction 0.5).
    // 3. Returns WITHOUT visiting front side (leaf 0).
    // Result: Hit at 100.

    // If optimization FAILS:
    // 1. ... visits leaf 0.
    // 2. Checks poison brush (x=50).
    // 3. Hits poison brush at x=50. Fraction ~0.16.
    // Result: Hit at 50.

    expect(result.fraction).toBeCloseTo((100 - 0.03125) / 300);
  });

  it('should not check brushes in nodes that are not traversed', () => {
    // Split plane at x=100.
    // Trace from 0 to 50.
    // Should only visit back leaf.
    // Poison brush in front leaf (x=20) should not be hit.

    const splitPlane = makePlane({ x: 1, y: 0, z: 0 }, 100);
    const nodes = [makeNode(splitPlane, [-1, -2])]; // -1 front, -2 back

    const poisonBrush = makeBrushFromMinsMaxs({ x: 20, y: -10, z: -10 }, { x: 30, y: 10, z: 10 });
    // Place poison brush in FRONT leaf (index 0)

    const model = makeBspModel(
      [splitPlane],
      nodes,
      [makeLeaf(0, 0, 1), makeLeaf(0, 0, 0)], // leaf 0 has 1 brush, leaf 1 has 0
      [poisonBrush],
      [0]
    );

    const start = { x: 0, y: 0, z: 0 };
    const end = { x: 50, y: 0, z: 0 };

    // Trace is entirely on back side of plane (0..50 < 100).
    // Should recurse ONLY to child 1 (back).
    // Child 0 (front) has the poison brush.

    const result = traceBox({ model, start, end });

    expect(result.fraction).toBe(1); // Should not hit poison brush
  });
});
