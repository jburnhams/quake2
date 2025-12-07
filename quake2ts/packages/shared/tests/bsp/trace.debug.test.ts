import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildCollisionModel,
  traceBox,
  enableTraceDebug,
  disableTraceDebug,
  traceDebugInfo,
  type CollisionLumpData,
  type CollisionModel,
} from '../../src/bsp/collision.js';
import { CONTENTS_SOLID } from '../../src/bsp/contents.js';

describe('traceBox optimization', () => {
  let model: CollisionModel;

  beforeEach(() => {
    // Create a simple BSP tree:
    // Root node splits world at x=0
    // Left child (x<0) is empty (Leaf 0)
    // Right child (x>=0) has a solid brush (Leaf 1)

    const lumps: CollisionLumpData = {
      planes: [
        { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 }, // Plane 0: x=0
      ],
      nodes: [
        { planenum: 0, children: [-2, -1] }, // Node 0: left child -> Leaf 1 (index -2), right child -> Leaf 0 (index -1)
      ],
      leaves: [
        { contents: 0, cluster: -1, area: -1, firstLeafBrush: 0, numLeafBrushes: 0 }, // Leaf 0: Empty
        { contents: CONTENTS_SOLID, cluster: -1, area: -1, firstLeafBrush: 0, numLeafBrushes: 1 }, // Leaf 1: Solid
      ],
      brushes: [
        { firstSide: 0, numSides: 6, contents: CONTENTS_SOLID }, // Brush 0: Box from (-100, -100, -100) to (-10, 100, 100)
      ],
      brushSides: [
        { planenum: 0, surfaceFlags: 0 },
      ],
      leafBrushes: [0], // Leaf 1 contains Brush 0
      bmodels: [],
    };

    // Adjust node children to match intent
    // Node 0: Plane x=0.
    // child[0] (front, x>0) -> Leaf 0 (Empty, index -1)
    // child[1] (back, x<0) -> Leaf 1 (Solid, index -2)
    lumps.nodes[0].children = [-1, -2];

    model = buildCollisionModel(lumps);
  });

  afterEach(() => {
    disableTraceDebug();
  });

  it('should traverse only relevant nodes and check relevant brushes', () => {
    enableTraceDebug();

    // Trace 1: Entirely in x > 0 (Leaf 0, Empty)
    // Start: (100, 0, 0), End: (50, 0, 0)
    // Should hit Node 0, go to child[0] (Leaf 0).
    // Should NOT visit Leaf 1 or check Brush 0.

    traceBox({
      model,
      start: { x: 100, y: 0, z: 0 },
      end: { x: 50, y: 0, z: 0 },
      mins: { x: -1, y: -1, z: -1 },
      maxs: { x: 1, y: 1, z: 1 },
    });

    expect(traceDebugInfo).not.toBeNull();
    // Trace hits root node
    expect(traceDebugInfo!.nodesTraversed).toBeGreaterThan(0);
    // Trace goes to leaf 0
    expect(traceDebugInfo!.leafsReached).toBeGreaterThan(0);
    expect(traceDebugInfo!.brushesTested).toBe(0);

    // Reset debug info
    enableTraceDebug();

    // Trace 2: Crosses from x > 0 to x < 0
    // Start: (10, 0, 0), End: (-20, 0, 0)
    // Should hit Node 0, visit child[0] and child[1].
    // Should visit Leaf 0 and Leaf 1.
    // Should check Brush 0.

    traceBox({
      model,
      start: { x: 10, y: 0, z: 0 },
      end: { x: -20, y: 0, z: 0 },
      mins: { x: -1, y: -1, z: -1 },
      maxs: { x: 1, y: 1, z: 1 },
    });

    expect(traceDebugInfo!.nodesTraversed).toBeGreaterThan(0);
    expect(traceDebugInfo!.leafsReached).toBeGreaterThan(0);
    // Since we cross into Leaf 1 which has a brush, we expect a brush test.
    expect(traceDebugInfo!.brushesTested).toBe(1);
  });

  it('should avoid checking brushes multiple times (checkcount)', () => {
    // Modify model to put Brush 0 in Leaf 0 as well
    const leaves = model.leaves;
    leaves[0].numLeafBrushes = 1;
    leaves[0].firstLeafBrush = 0; // Points to same index in leafBrushes

    enableTraceDebug();

    // Trace crossing the plane, visiting both leaves
    // Both leaves contain Brush 0.
    // Brush 0 should be tested only ONCE.

    traceBox({
      model,
      start: { x: 10, y: 0, z: 0 },
      end: { x: -10, y: 0, z: 0 },
      mins: { x: 0, y: 0, z: 0 },
      maxs: { x: 0, y: 0, z: 0 },
    });

    expect(traceDebugInfo!.leafsReached).toBeGreaterThan(0);
    // Verify checkcount optimization works: brush should be tested exactly once.
    expect(traceDebugInfo!.brushesTested).toBe(1);
  });
});
