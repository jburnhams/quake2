import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import {
  mergeCoplanarFaces,
  tryMergeWinding,
  extractFaces,
  assignFacesToNodes
} from '../../../src/compiler/faces';
import type { CompileFace } from '../../../src/types/compile';
import { buildTree, isLeaf, type TreeNode } from '../../../src/compiler/tree';
import { PlaneSet } from '../../../src/compiler/planes';
import { box } from '../../../src/builder/primitives';
import { createCompileBrush } from './helpers';

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
      // Concave case:
      // w1 (0,0)-(2,1)
      // w2 (0,1)-(1,2)
      // See original test for logic details

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
      // 2x2 grid
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
        winding: { numPoints: 4, points: [] } as any as Winding, // dummy
        planeNum: 0,
        texInfo: 0,
        contents: 0,
        next: null
      };
      const f2 = {
        winding: { numPoints: 4, points: [] } as any as Winding,
        planeNum: 0,
        texInfo: 1, // diff texture
        contents: 0,
        next: null
      };

      const merged = mergeCoplanarFaces([f1, f2]);
      expect(merged.length).toBe(2);
    });
  });

  describe('extractFaces', () => {
    it('extracts faces from a simple box', () => {
      // 1. Create a box brush
      const bDef = box({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
      });
      const planeSet = new PlaneSet();
      const brush = createCompileBrush(bDef, planeSet, CONTENTS_SOLID);

      // 2. Build tree
      const tree = buildTree([brush], planeSet);

      // Verify tree is not just a leaf
      expect(isLeaf(tree)).toBe(false);

      const faces = extractFaces(tree, planeSet.getPlanes());

      // Should have 6 visible faces (the outer walls) because they face the void (Empty)
      expect(faces.length).toBe(6);

      // Verify faces
      // Size 64x64 = 4096
      for (const f of faces) {
        expect(windingArea(f.winding)).toBeCloseTo(4096);
      }
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns faces to correct nodes', () => {
       const bDef = box({
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
       });
       const planeSet = new PlaneSet();
       const brush = createCompileBrush(bDef, planeSet, CONTENTS_SOLID);
       const tree = buildTree([brush], planeSet);
       const faces = extractFaces(tree, planeSet.getPlanes());

       const assigned = assignFacesToNodes(faces, tree, planeSet.getPlanes());

       // Traverse tree and count assigned faces
       let count = 0;
       const traverse = (node: any) => {
           if (isLeaf(node)) return;
           if (assigned.has(node)) {
               count += assigned.get(node)!.length;
           }
           traverse(node.children[0]);
           traverse(node.children[1]);
       };
       traverse(tree);

       // All 6 faces should be assigned to nodes
       expect(count).toBe(6);
    });
  });
});
