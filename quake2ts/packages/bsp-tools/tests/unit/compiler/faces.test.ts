import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  createEmptyBounds3,
  CONTENTS_SOLID
} from '@quake2ts/shared';
import {
  mergeCoplanarFaces,
  tryMergeWinding,
  extractFaces,
  assignFacesToNodes
} from '../../../src/compiler/faces';
import type { CompileFace, CompileBrush } from '../../../src/types/compile';
import { PlaneSet } from '../../../src/compiler/planes';
import { createCompileBrush } from './helpers';
import { box } from '../../../src/builder/primitives';
import { buildTree, type TreeElement, isLeaf } from '../../../src/compiler/tree';

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
    it('extracts faces from two separated brushes', () => {
      const planeSet = new PlaneSet();
      // Brush 1 at (-100, 0, 0)
      const b1 = box({
        origin: { x: -100, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
      });
      // Brush 2 at (100, 0, 0)
      const b2 = box({
        origin: { x: 100, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
      });

      const brush1 = createCompileBrush(b1, planeSet, CONTENTS_SOLID);
      const brush2 = createCompileBrush(b2, planeSet, CONTENTS_SOLID);
      const brushes = [brush1, brush2];

      // Tree should split space between them
      const tree = buildTree(brushes, planeSet);

      // Extract faces
      const faces = extractFaces(brushes, tree, planeSet);

      // Both boxes have 6 faces. 12 total.
      // Visible faces should be those bordering empty space.
      // Since they are separated, all faces should be visible (bordering the void/empty split).

      expect(faces.length).toBeGreaterThanOrEqual(12);

      for (const f of faces) {
        expect(f.winding.numPoints).toBeGreaterThanOrEqual(3);
        expect(f.side).toBeDefined();
      }
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns extracted faces to tree nodes', () => {
      const planeSet = new PlaneSet();
      const b1 = box({
        origin: { x: -100, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
      });
      const b2 = box({
        origin: { x: 100, y: 0, z: 0 },
        size: { x: 64, y: 64, z: 64 }
      });
      const brush1 = createCompileBrush(b1, planeSet, CONTENTS_SOLID);
      const brush2 = createCompileBrush(b2, planeSet, CONTENTS_SOLID);
      const brushes = [brush1, brush2];

      const tree = buildTree(brushes, planeSet);
      const faces = extractFaces(brushes, tree, planeSet);

      const assignments = assignFacesToNodes(faces, tree, planeSet);

      let totalAssigned = 0;
      for (const list of assignments.values()) {
        totalAssigned += list.length;
      }

      expect(totalAssigned).toBeGreaterThanOrEqual(12);

      for (const [node, nodeList] of assignments) {
         for (const face of nodeList) {
           expect(face.winding.numPoints).toBeGreaterThanOrEqual(3);
         }
      }
    });
  });
});
