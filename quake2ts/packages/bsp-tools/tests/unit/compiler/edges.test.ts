import { describe, it, expect } from 'vitest';
import { buildEdges } from '../../../src/compiler/edges.js';
import type { CompileFace } from '../../../src/types/compile.js';
import type { Winding } from '@quake2ts/shared';

describe('buildEdges', () => {
  it('builds edge list for a single square', () => {
    const w: Winding = {
      numPoints: 4,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 }
      ]
    };

    const face: CompileFace = {
      winding: w,
      planeNum: 0,
      texInfo: 0,
      contents: 0,
      next: null
    };

    const result = buildEdges([face]);

    expect(result.vertices.length).toBe(4);
    expect(result.edges.length).toBe(4);
    expect(result.surfEdges.length).toBe(4);

    // Edges should be numbered 0, 1, 2, 3
    // Assuming vertices added 0, 1, 2, 3
    // Edge 0: v0-v1
    // Edge 1: v1-v2
    // Edge 2: v2-v3
    // Edge 3: v3-v0
    expect(result.surfEdges[0]).toBe(0);
    expect(result.surfEdges[1]).toBe(1);
    expect(result.surfEdges[2]).toBe(2);
    expect(result.surfEdges[3]).toBe(3);
  });

  it('shares edges between adjacent faces', () => {
    // Face 1: (0,0)-(1,0)-(1,1)-(0,1)  (Square 1)
    const w1: Winding = {
      numPoints: 4,
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 0, y: 1, z: 0 }
      ]
    };

    // Face 2: (1,0)-(2,0)-(2,1)-(1,1) (Square 2)
    // Shares edge (1,0)-(1,1)
    // Face 1 edge: (1,0) -> (1,1) [Index 1, vertices v1, v2]
    // Face 2 edge: (1,1) -> (1,0) [Reversed, vertices v2, v1]
    const w2: Winding = {
      numPoints: 4,
      points: [
        { x: 1, y: 0, z: 0 },
        { x: 2, y: 0, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 }
      ]
    };

    const f1: CompileFace = { winding: w1, planeNum: 0, texInfo: 0, contents: 0, next: null };
    const f2: CompileFace = { winding: w2, planeNum: 0, texInfo: 0, contents: 0, next: null };

    const result = buildEdges([f1, f2]);

    // Total vertices: (0,0), (1,0), (1,1), (0,1), (2,0), (2,1) -> 6 vertices
    expect(result.vertices.length).toBe(6);

    // Edges:
    // F1: (0,0)-(1,0) [New]
    //     (1,0)-(1,1) [New] -> Shared
    //     (1,1)-(0,1) [New]
    //     (0,1)-(0,0) [New]
    // F2: (1,0)-(2,0) [New]
    //     (2,0)-(2,1) [New]
    //     (2,1)-(1,1) [New]
    //     (1,1)-(1,0) [Existing, reversed]

    // Total edges: 4 + 3 = 7 unique edges
    expect(result.edges.length).toBe(7);

    // SurfEdges: 4 for F1, 4 for F2 = 8
    expect(result.surfEdges.length).toBe(8);

    // Verify shared edge direction
    // F1 edge index 1 is v1->v2 (positive)
    // F2 edge index 7 is v2->v1 (negative of edge 1)
    // Find the index of the shared edge in surfEdges
    // It's usually the 2nd edge of F1 (index 1) and 4th edge of F2 (index 7)

    // Vertices order: v0(0,0), v1(1,0), v2(1,1), v3(0,1), v4(2,0), v5(2,1)
    // Edges:
    // 0: v0-v1
    // 1: v1-v2 (Shared)
    // 2: v2-v3
    // 3: v3-v0
    // 4: v1-v4
    // 5: v4-v5
    // 6: v5-v2

    // F1 surfEdges: 0, 1, 2, 3
    // F2 surfEdges: 4, 5, 6, -1 (points to edge 1 reversed)

    expect(result.surfEdges[1]).toBeGreaterThan(0); // v1->v2
    expect(result.surfEdges[7]).toBeLessThan(0);    // v2->v1 (reversed)
    expect(Math.abs(result.surfEdges[7])).toBe(result.surfEdges[1]);
  });
});
