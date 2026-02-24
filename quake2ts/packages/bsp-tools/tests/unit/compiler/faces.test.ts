import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import {
  extractFaces,
  assignFacesToNodes,
  mergeCoplanarFaces,
  tryMergeWinding
} from '../../../src/compiler/faces';
import type { CompileFace, CompileBrush, CompilePlane, CompileSide } from '../../../src/types/compile';
import type { TreeNode, TreeLeaf, TreeElement } from '../../../src/compiler/tree';

describe('faces', () => {
  // Helpers
  const createPlane = (normal: {x:number,y:number,z:number}, dist: number): CompilePlane => ({
    normal, dist, type: 0
  });

  const createBrush = (contents: number): CompileBrush => ({
    original: { contents } as any,
    sides: [],
    bounds: { mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} },
    next: null
  });

  const createSide = (planeNum: number, winding: Winding): CompileSide => ({
    planeNum,
    winding,
    texInfo: 0,
    visible: true,
    tested: false,
    bevel: false
  });

  describe('extractFaces', () => {
    it('extracts faces bordering empty space', () => {
      // Setup simple tree: Plane X=0
      // Front (X>0): Empty
      // Back (X<0): Solid

      const planes: CompilePlane[] = [
        createPlane({x: 1, y: 0, z: 0}, 0) // Plane 0: x=0
      ];

      const emptyLeaf: TreeLeaf = {
        contents: 0,
        brushes: [],
        bounds: { mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} }
      };

      // Create a brush that lives in the solid leaf
      // Face at x=0, normal (1,0,0).
      // 4 points: (0, -10, -10) ... (0, 10, 10)
      const faceWinding: Winding = {
        numPoints: 4,
        points: [
          {x:0, y:-10, z:10},
          {x:0, y:10, z:10},
          {x:0, y:10, z:-10},
          {x:0, y:-10, z:-10}
        ]
      };

      const brush = createBrush(CONTENTS_SOLID);
      brush.sides.push(createSide(0, faceWinding));

      const solidLeaf: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [brush],
        bounds: { mins: {x:-100,y:-100,z:-100}, maxs: {x:0,y:100,z:100} }
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [emptyLeaf, solidLeaf],
        bounds: { mins: {x:-100,y:-100,z:-100}, maxs: {x:100,y:100,z:100} }
      };

      const extracted = extractFaces(root, planes);

      expect(extracted.length).toBe(1);
      expect(extracted[0].planeNum).toBe(0);
      expect(extracted[0].winding.numPoints).toBe(4);
    });

    it('discards faces inside solid space', () => {
      // Setup simple tree: Plane X=0
      // Front (X>0): Solid
      // Back (X<0): Solid
      // (Everything solid)

      const planes: CompilePlane[] = [
        createPlane({x: 1, y: 0, z: 0}, 0)
      ];

      const solidLeaf1: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [],
        bounds: { mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} }
      };

      const faceWinding: Winding = {
        numPoints: 4,
        points: [
          {x:0, y:-10, z:10},
          {x:0, y:10, z:10},
          {x:0, y:10, z:-10},
          {x:0, y:-10, z:-10}
        ]
      };

      const brush = createBrush(CONTENTS_SOLID);
      brush.sides.push(createSide(0, faceWinding));

      const solidLeaf2: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [brush],
        bounds: { mins: {x:-100,y:0,z:0}, maxs: {x:0,y:0,z:0} }
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [solidLeaf1, solidLeaf2], // Front is solid too
        bounds: { mins: {x:0,y:0,z:0}, maxs: {x:0,y:0,z:0} }
      };

      const extracted = extractFaces(root, planes);

      expect(extracted.length).toBe(0);
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns faces to the correct node', () => {
      const planes: CompilePlane[] = [
        createPlane({x: 1, y: 0, z: 0}, 0),   // Plane 0: x=0
        createPlane({x: 0, y: 1, z: 0}, 0)    // Plane 1: y=0
      ];

      const leaf: TreeLeaf = {
        contents: 0, brushes: [], bounds: {mins:{x:0,y:0,z:0}, maxs:{x:0,y:0,z:0}}
      };

      // Tree: Root(P0) -> Front(Child(P1)), Back(Leaf)
      const childNode: TreeNode = {
        planeNum: 1,
        children: [leaf, leaf],
        bounds: {mins:{x:0,y:0,z:0}, maxs:{x:0,y:0,z:0}}
      };

      const root: TreeNode = {
        planeNum: 0,
        children: [childNode, leaf],
        bounds: {mins:{x:0,y:0,z:0}, maxs:{x:0,y:0,z:0}}
      };

      // Face on Plane 0 (x=0)
      const face0: CompileFace = {
        planeNum: 0,
        winding: { numPoints: 3, points: [{x:0,y:0,z:0}, {x:0,y:1,z:0}, {x:0,y:0,z:1}] },
        texInfo: 0, contents: 0, next: null
      };

      // Face on Plane 1 (y=0)
      const face1: CompileFace = {
        planeNum: 1,
        winding: { numPoints: 3, points: [{x:10,y:0,z:0}, {x:11,y:0,z:0}, {x:10,y:0,z:1}] },
        texInfo: 0, contents: 0, next: null
      };

      const faces = [face0, face1];
      const map = assignFacesToNodes(faces, root, planes);

      expect(map.get(root)).toBeDefined();
      expect(map.get(root)).toContain(face0);

      expect(map.get(childNode)).toBeDefined();
      expect(map.get(childNode)).toContain(face1);
    });
  });

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
      expect(merged!.numPoints).toBe(4);
      expect(windingArea(merged!)).toBeCloseTo(2.0);
    });

    it('does not merge if result is concave (L-shape)', () => {
      // rectW: (0,0)->(2,0)->(2,1)->(0,1)
      const rectW: Winding = {
        numPoints: 4,
        points: [
            { x: 0, y: 1, z: 0 },
            { x: 2, y: 1, z: 0 },
            { x: 2, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 }
        ]
      };

      // squareW: (0,1)->(1,1)->(1,2)->(0,2) (above left part)
      const squareW: Winding = {
        numPoints: 4,
        points: [
            { x: 0, y: 2, z: 0 },
            { x: 1, y: 2, z: 0 },
            { x: 1, y: 1, z: 0 },
            { x: 0, y: 1, z: 0 }
        ]
      };

      const normal = { x: 0, y: 0, z: 1 };
      // This should fail because they don't share a full edge (vertices don't align for easy merge)
      // or result is concave
      expect(tryMergeWinding(rectW, squareW, normal)).toBeNull();
    });
  });

  describe('mergeCoplanarFaces', () => {
    it('merges a grid of 4 squares into 1', () => {
      // 2x2 grid
      const tl = { numPoints: 4, points: [{x:0,y:2,z:0}, {x:1,y:2,z:0}, {x:1,y:1,z:0}, {x:0,y:1,z:0}] };
      const tr = { numPoints: 4, points: [{x:1,y:2,z:0}, {x:2,y:2,z:0}, {x:2,y:1,z:0}, {x:1,y:1,z:0}] };
      const bl = { numPoints: 4, points: [{x:0,y:1,z:0}, {x:1,y:1,z:0}, {x:1,y:0,z:0}, {x:0,y:0,z:0}] };
      const br = { numPoints: 4, points: [{x:1,y:1,z:0}, {x:2,y:1,z:0}, {x:2,y:0,z:0}, {x:1,y:0,z:0}] };

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
      const f1: CompileFace = {
        winding: { numPoints: 4, points: [] } as any,
        planeNum: 0, texInfo: 0, contents: 0, next: null
      };
      const f2: CompileFace = {
        winding: { numPoints: 4, points: [] } as any,
        planeNum: 0, texInfo: 1, contents: 0, next: null
      };

      const merged = mergeCoplanarFaces([f1, f2]);
      expect(merged.length).toBe(2);
    });
  });
});
