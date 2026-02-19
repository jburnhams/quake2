import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  createEmptyBounds3
} from '@quake2ts/shared';
import {
  mergeCoplanarFaces,
  tryMergeWinding,
  extractFaces,
  assignFacesToNodes,
  fixTJunctions
} from '../../../src/compiler/faces';
import type { CompileFace, CompilePlane, CompileBrush, CompileSide } from '../../../src/types/compile';
import type { TreeElement, TreeNode, TreeLeaf } from '../../../src/compiler/tree';

describe('faces', () => {
  describe('tryMergeWinding', () => {
    it('merges two adjacent squares into a rectangle', () => {
      // Square 1: (0,0) to (1,1)
      const w1: Winding = {
        numPoints: 4,
        points: [
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 }
        ]
      };

      // Square 2: (1,0) to (2,1) - shares edge x=1
      const w2: Winding = {
        numPoints: 4,
        points: [
          { x: 1, y: 1, z: 0 },
          { x: 2, y: 1, z: 0 },
          { x: 2, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 }
        ]
      };

      // Normal is Z-up (0,0,1)
      const normal = { x: 0, y: 0, z: 1 };

      const merged = tryMergeWinding(w1, w2, normal);

      expect(merged).not.toBeNull();
      expect(merged!.numPoints).toBe(4); // Rectangle

      // Verify area (1x1 + 1x1 = 2)
      expect(windingArea(merged!)).toBeCloseTo(2.0);
    });

    it('does not merge if result is concave (L-shape)', () => {
      const rectW: Winding = {
        numPoints: 4,
        points: [
            { x: 0, y: 1, z: 0 },
            { x: 2, y: 1, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 }
        ]
      }; // 2x1 rect

      const squareW: Winding = {
        numPoints: 4,
        points: [
            { x: 0, y: 2, z: 0 },
            { x: 1, y: 2, z: 0 },
            { x: 1, y: 1, z: 0 },
            { x: 0, y: 1, z: 0 }
        ]
      }; // 1x1 above left part

      const normal = { x: 0, y: 0, z: 1 };
      expect(tryMergeWinding(rectW, squareW, normal)).toBeNull();
    });
  });

  describe('mergeCoplanarFaces', () => {
    it('merges a grid of 4 squares into 1', () => {
      const tl = {
        numPoints: 4,
        points: [{x:0,y:2,z:0}, {x:1,y:2,z:0}, {x:1,y:1,z:0}, {x:0,y:1,z:0}]
      };
      const tr = {
        numPoints: 4,
        points: [{x:1,y:2,z:0}, {x:2,y:2,z:0}, {x:2,y:1,z:0}, {x:1,y:1,z:0}]
      };
      const bl = {
        numPoints: 4,
        points: [{x:0,y:1,z:0}, {x:1,y:1,z:0}, {x:1,y:0,z:0}, {x:0,y:0,z:0}]
      };
      const br = {
        numPoints: 4,
        points: [{x:1,y:1,z:0}, {x:2,y:1,z:0}, {x:2,y:0,z:0}, {x:1,y:0,z:0}]
      };

      const faces: CompileFace[] = [
        { winding: tl, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null },
        { winding: tr, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null },
        { winding: bl, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null },
        { winding: br, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null }
      ];

      const merged = mergeCoplanarFaces(faces);

      expect(merged.length).toBe(1);
      expect(merged[0].winding.numPoints).toBe(4);
      expect(windingArea(merged[0].winding)).toBeCloseTo(4.0);
    });

    it('does not merge faces with different textures', () => {
      const f1 = {
        winding: { numPoints: 4, points: [] } as any as Winding, // dummy
        planeNum: 0,
        side: 0,
        texInfo: 0,
        contents: 0,
        next: null
      };
      const f2 = {
        winding: { numPoints: 4, points: [] } as any as Winding,
        planeNum: 0,
        side: 0,
        texInfo: 1, // diff texture
        contents: 0,
        next: null
      };

      const merged = mergeCoplanarFaces([f1, f2]);
      expect(merged.length).toBe(2);
    });
  });

  describe('extractFaces', () => {
    it('extracts faces from a simple tree', () => {
      // Create a brush side winding (Square on Z=0)
      const w: Winding = {
        numPoints: 4,
        points: [
          { x: 0, y: 10, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 }
        ]
      };

      const side: CompileSide = {
        planeNum: 0,
        texInfo: 0,
        winding: w,
        visible: true,
        tested: false,
        bevel: false
      };

      const brush: CompileBrush = {
        original: { sides: [], bounds: createEmptyBounds3(), contents: 1, entityNum: 0, brushNum: 0 },
        sides: [side],
        bounds: createEmptyBounds3(),
        next: null
      };
      brush.original.sides = [side]; // cyclic ref logic in map parser, here manual

      // Create tree: Root splits on Z=0 (Plane 0).
      // Front child (Z>0) is Empty Leaf.
      // Back child (Z<0) is Solid Leaf.

      const planes: CompilePlane[] = [
        { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0 }
      ];

      const emptyLeaf: TreeLeaf = {
        contents: 0, // Empty
        brushes: [brush],
        bounds: createEmptyBounds3()
      };

      const solidLeaf: TreeLeaf = {
        contents: 1, // Solid
        brushes: [],
        bounds: createEmptyBounds3()
      };

      // Note: brush is in empty leaf? No, brush spans.
      // But for this test, let's say the brush is in the empty leaf.
      // extractFaces iterates brushes found in the tree.

      const root: TreeNode = {
        planeNum: 0,
        children: [emptyLeaf, solidLeaf],
        bounds: createEmptyBounds3()
      };

      const faces = extractFaces(root, planes);

      // The winding is on Z=0.
      // splitWinding(w, Z=0) -> if on plane, puts on front?
      // If on front, it goes to emptyLeaf.
      // emptyLeaf contents=0 -> visible.
      // So we expect 1 face.

      expect(faces.length).toBe(1);
      expect(faces[0].planeNum).toBe(0);
      expect(faces[0].winding.numPoints).toBe(4);
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns extracted faces to the correct node', () => {
      const w: Winding = {
        numPoints: 4,
        points: [
          { x: 0, y: 10, z: 0 },
          { x: 10, y: 10, z: 0 },
          { x: 10, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 }
        ]
      };
      const face: CompileFace = {
        planeNum: 0,
        side: 0,
        texInfo: 0,
        winding: w,
        contents: 0,
        next: null
      };

      const planes: CompilePlane[] = [
        { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0 }
      ];

      const root: TreeNode = {
        planeNum: 0,
        children: [
            { contents: 0, brushes: [], bounds: createEmptyBounds3() } as TreeLeaf,
            { contents: 1, brushes: [], bounds: createEmptyBounds3() } as TreeLeaf
        ],
        bounds: createEmptyBounds3()
      };

      const map = assignFacesToNodes([face], root, planes);

      // Face is on Z=0, node plane is Z=0. Should be assigned to root.
      expect(map.has(root)).toBe(true);
      expect(map.get(root)!.length).toBe(1);
    });
  });

  describe('fixTJunctions', () => {
    it('adds vertices to fix T-junctions', () => {
      // Face 1: (0,0)-(2,0)-(2,1)-(0,1)
      const w1 = {
        numPoints: 4,
        points: [
            { x: 0, y: 1, z: 0 },
            { x: 2, y: 1, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 }
        ]
      };

      // Face 2: (1,1)-(1,2)-(2,2)-(2,1)
      // Vertex (1,1) is on top edge of Face 1 (0,1)-(2,1).
      const w2 = {
        numPoints: 4,
        points: [
            { x: 1, y: 2, z: 0 },
            { x: 2, y: 2, z: 0 },
            { x: 2, y: 1, z: 0 },
            { x: 1, y: 1, z: 0 }
        ]
      };

      const f1: CompileFace = { winding: w1, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null };
      const f2: CompileFace = { winding: w2, planeNum: 0, side: 0, texInfo: 0, contents: 0, next: null };

      fixTJunctions([f1, f2]);

      // Face 1 should now have 5 points (vertex added at 1,1)
      expect(f1.winding.numPoints).toBe(5);

      // Verify (1,1) is in points
      const hasPoint = f1.winding.points.some(p =>
        Math.abs(p.x - 1) < 0.01 && Math.abs(p.y - 1) < 0.01 && Math.abs(p.z - 0) < 0.01
      );
      expect(hasPoint).toBe(true);
    });
  });
});
