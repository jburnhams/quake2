import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  CONTENTS_SOLID,
  CONTENTS_NONE,
  createEmptyBounds3
} from '@quake2ts/shared';
import {
  mergeCoplanarFaces,
  tryMergeWinding,
  extractFaces,
  assignFacesToNodes
} from '../../../src/compiler/faces';
import type { CompileFace, CompilePlane, MapBrush } from '../../../src/types/compile';
import type { TreeElement, TreeNode, TreeLeaf } from '../../../src/compiler/tree';

// Helper to create a dummy brush
function createDummyBrush(sides: any[], contents: number = CONTENTS_SOLID): MapBrush {
  return {
    entityNum: 0,
    brushNum: 0,
    sides: sides,
    bounds: createEmptyBounds3(),
    contents
  };
}

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

      const normal = { x: 0, y: 0, z: 1 };

      const merged = tryMergeWinding(w1, w2, normal);

      expect(merged).not.toBeNull();
      expect(merged!.numPoints).toBe(4); // Rectangle
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
        { winding: tl, planeNum: 0, texInfo: 0, contents: 0, next: null },
        { winding: tr, planeNum: 0, texInfo: 0, contents: 0, next: null },
        { winding: bl, planeNum: 0, texInfo: 0, contents: 0, next: null },
        { winding: br, planeNum: 0, texInfo: 0, contents: 0, next: null }
      ];

      const merged = mergeCoplanarFaces(faces);

      expect(merged.length).toBe(1);
      expect(merged[0].winding.numPoints).toBe(4);
      expect(windingArea(merged[0].winding)).toBeCloseTo(4.0);
    });

    it('does not merge faces with different textures', () => {
      const f1 = {
        winding: { numPoints: 4, points: [] } as any as Winding,
        planeNum: 0,
        texInfo: 0,
        contents: 0,
        next: null
      };
      const f2 = {
        winding: { numPoints: 4, points: [] } as any as Winding,
        planeNum: 0,
        texInfo: 1,
        contents: 0,
        next: null
      };

      const merged = mergeCoplanarFaces([f1, f2]);
      expect(merged.length).toBe(2);
    });
  });

  describe('extractFaces', () => {
    it('extracts faces bordering empty space', () => {
      const planes: CompilePlane[] = [
        { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 }
      ];

      const sideWinding: Winding = {
        numPoints: 4,
        points: [
          { x: 0, y: 1, z: 1 },
          { x: 0, y: 1, z: -1 },
          { x: 0, y: -1, z: -1 },
          { x: 0, y: -1, z: 1 }
        ]
      };

      const side = {
        planeNum: 0,
        texInfo: 0,
        winding: sideWinding,
        visible: true,
        tested: false,
        bevel: false
      };

      const brush = createDummyBrush([side], CONTENTS_SOLID);

      const emptyLeaf: TreeLeaf = {
        contents: CONTENTS_NONE,
        brushes: [{ original: brush } as any],
        bounds: createEmptyBounds3()
      };

      const solidLeaf: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [{ original: brush } as any],
        bounds: createEmptyBounds3()
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [emptyLeaf, solidLeaf], // Front (X>0) is Empty. Side faces Front (X>0).
        bounds: createEmptyBounds3()
      };

      const faces = extractFaces(root, planes);

      expect(faces.length).toBe(1);
      expect(faces[0].planeNum).toBe(0);
    });

    it('discards faces between two solid leaves', () => {
      const planes: CompilePlane[] = [
        { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 }
      ];

      const sideWinding: Winding = {
        numPoints: 3,
        points: [{x:0,y:1,z:0}, {x:0,y:0,z:0}, {x:0,y:0,z:1}]
      };

      const side = {
        planeNum: 0,
        texInfo: 0,
        winding: sideWinding,
        visible: true,
        tested: false,
        bevel: false
      };

      const brush = createDummyBrush([side], CONTENTS_SOLID);

      const solidLeaf1: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [{ original: brush } as any],
        bounds: createEmptyBounds3()
      };
      const solidLeaf2: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [{ original: brush } as any],
        bounds: createEmptyBounds3()
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [solidLeaf1, solidLeaf2],
        bounds: createEmptyBounds3()
      };

      const faces = extractFaces(root, planes);
      expect(faces.length).toBe(0);
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns face to the node with matching plane', () => {
      const planes: CompilePlane[] = [
        { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 }
      ];

      const winding: Winding = {
        numPoints: 3,
        points: [{x:0,y:1,z:0}, {x:0,y:0,z:0}, {x:0,y:0,z:1}]
      };

      const face: CompileFace = {
        planeNum: 0,
        texInfo: 0,
        winding: winding,
        contents: CONTENTS_SOLID,
        next: null
      };

      const leaf: TreeLeaf = {
        contents: 0,
        brushes: [],
        bounds: createEmptyBounds3()
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [leaf, leaf],
        bounds: createEmptyBounds3()
      };

      const map = assignFacesToNodes([face], root, planes);

      expect(map.has(root)).toBe(true);
      expect(map.get(root)!.length).toBe(1);
      expect(map.get(root)![0]).toBe(face);
    });

    it('traverses down to find matching node', () => {
      const planes: CompilePlane[] = [
        { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 },
        { normal: { x: 1, y: 0, z: 0 }, dist: 10, type: 0 }
      ];

      // Face on Plane 1 (X=10)
      const winding: Winding = {
        numPoints: 3,
        points: [{x:10,y:1,z:0}, {x:10,y:0,z:0}, {x:10,y:0,z:1}]
      };

      const face: CompileFace = {
        planeNum: 1,
        texInfo: 0,
        winding: winding,
        contents: CONTENTS_SOLID,
        next: null
      };

      const leaf: TreeLeaf = {
        contents: 0,
        brushes: [],
        bounds: createEmptyBounds3()
      };

      const child: TreeNode = {
        planeNum: 1,
        children: [leaf, leaf],
        bounds: createEmptyBounds3()
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [child, leaf],
        bounds: createEmptyBounds3()
      };

      const map = assignFacesToNodes([face], root, planes);

      expect(map.has(root)).toBe(false);
      expect(map.has(child)).toBe(true);
      expect(map.get(child)![0]).toBe(face);
    });
  });
});
