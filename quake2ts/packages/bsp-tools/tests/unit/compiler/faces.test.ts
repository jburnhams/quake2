import { describe, it, expect } from 'vitest';
import {
  type Winding,
  createWinding,
  windingArea,
  CONTENTS_SOLID,
  CONTENTS_NONE
} from '@quake2ts/shared';
import {
  extractFaces,
  assignFacesToNodes,
  mergeCoplanarFaces,
  tryMergeWinding,
  fixTJunctions
} from '../../../src/compiler/faces.js';
import type { CompileFace, CompileBrush } from '../../../src/types/compile.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { createCompileBrush } from './helpers.js';
import type { TreeLeaf, TreeNode, TreeElement } from '../../../src/compiler/tree.js';

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
      // 2x2 grid
      // Top-Left: (0,1)-(1,2)
      // Top-Right: (1,1)-(2,2)
      // Bot-Left: (0,0)-(1,1)
      // Bot-Right: (1,0)-(2,1)

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
      ] as any;

      const merged = mergeCoplanarFaces(faces);

      expect(merged.length).toBe(1);
      expect(merged[0].winding.numPoints).toBe(4);
      expect(windingArea(merged[0].winding)).toBeCloseTo(4.0);
    });
  });

  describe('extractFaces', () => {
    it('extracts faces from a brush bordering empty space', () => {
      // 1. Setup
      const planeSet = new PlaneSet();
      const b = box({
        origin: { x: 0, y: 0, z: -32 }, // Box from Z=-64 to Z=0
        size: { x: 64, y: 64, z: 64 }
      });

      // Convert to CompileBrush
      const brush = createCompileBrush(b, planeSet, CONTENTS_SOLID);

      // 2. Construct Tree
      // Split plane at Z=0.
      // Front: Empty (Z > 0)
      // Back: Solid (Z < 0) - contains our brush

      // Find Z=0 plane (Normal 0,0,1, Dist 0)
      const zPlaneNum = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0);

      const emptyLeaf: TreeLeaf = {
        contents: CONTENTS_NONE,
        brushes: [],
        bounds: { mins: {x:-100,y:-100,z:0}, maxs: {x:100,y:100,z:100} } // simplified bounds
      };

      const solidLeaf: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [brush],
        bounds: { mins: {x:-100,y:-100,z:-100}, maxs: {x:100,y:100,z:0} }
      };

      const root: TreeNode = {
        planeNum: zPlaneNum,
        children: [emptyLeaf, solidLeaf], // Front (Empty), Back (Solid)
        bounds: { mins: {x:-100,y:-100,z:-100}, maxs: {x:100,y:100,z:100} }
      };

      // 3. Extract Faces
      const faces = extractFaces(root, planeSet.getPlanes());

      // 4. Verification
      // The top face of the box is at Z=0.
      // It lies ON the split plane.
      // Its normal is (0,0,1).
      // It aligns with the split plane normal.
      // So it should be sent to Front child (Empty).
      // Since Front is Empty, it is visible.

      // The bottom face (Z=-64) is in Back child (Solid). Hidden.
      // Side faces (X+, X-, Y+, Y-) are in Back child (Solid). Hidden.

      // Expect 1 face
      expect(faces.length).toBe(1);

      const face = faces[0];
      // Note: face.planeNum from extractFaces is the original brush side plane.
      // The brush side plane for top face (Z=0) is stored in the brush.
      // It should match zPlaneNum because createCompileBrush uses planeSet.
      expect(face.planeNum).toBe(zPlaneNum);
      // Verify area (64x64 = 4096)
      expect(windingArea(face.winding)).toBeCloseTo(4096);
    });

    it('hides faces inside solid volume', () => {
       // Brush completely inside solid leaf
       // Just a single Solid leaf with a brush
       const planeSet = new PlaneSet();
       const b = box({ origin: {x:0,y:0,z:0}, size: {x:64,y:64,z:64} });
       const brush = createCompileBrush(b, planeSet, CONTENTS_SOLID);

       const root: TreeLeaf = {
         contents: CONTENTS_SOLID,
         brushes: [brush],
         bounds: { mins: {x:-100,y:-100,z:-100}, maxs: {x:100,y:100,z:100} }
       };

       const faces = extractFaces(root, planeSet.getPlanes());
       expect(faces.length).toBe(0);
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns faces to the correct tree element', () => {
       const planeSet = new PlaneSet();
       const zPlaneNum = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0);

       // Create a face at Z=10 (Front of plane Z=0)
       const frontWinding = createWinding(3);
       frontWinding.points = [
         {x:0,y:0,z:10}, {x:10,y:0,z:10}, {x:0,y:10,z:10}
       ];

       // Create a face at Z=-10 (Back of plane Z=0)
       const backWinding = createWinding(3);
       backWinding.points = [
         {x:0,y:0,z:-10}, {x:10,y:0,z:-10}, {x:0,y:10,z:-10}
       ];

       // Create tree
       const frontLeaf: TreeLeaf = { contents: CONTENTS_NONE, brushes: [], bounds: {} as any };
       const backLeaf: TreeLeaf = { contents: CONTENTS_SOLID, brushes: [], bounds: {} as any };

       const root: TreeNode = {
         planeNum: zPlaneNum,
         children: [frontLeaf, backLeaf],
         bounds: {} as any
       };

       const faces: CompileFace[] = [
         { winding: frontWinding, planeNum: 0, texInfo: 0, contents: 0, next: null },
         { winding: backWinding, planeNum: 0, texInfo: 0, contents: 0, next: null }
       ];

       const map = assignFacesToNodes(faces, root, planeSet.getPlanes());

       // Expect frontFace to be in frontLeaf
       const frontFaces = map.get(frontLeaf);
       expect(frontFaces).toBeDefined();
       expect(frontFaces!.length).toBe(1);
       expect(frontFaces![0].winding).toBe(frontWinding);

       // Expect backFace to be in backLeaf
       const backFaces = map.get(backLeaf);
       expect(backFaces).toBeDefined();
       expect(backFaces!.length).toBe(1);
       expect(backFaces![0].winding).toBe(backWinding);
    });
  });

  describe('fixTJunctions', () => {
    it('inserts vertices at T-junctions', () => {
      // Face 1: (0,0)-(20,20)
      const w1 = createWinding(4);
      w1.points = [
        {x:0,y:20,z:0}, {x:20,y:20,z:0}, {x:20,y:0,z:0}, {x:0,y:0,z:0}
      ];

      // Face 2: (20,0)-(40,10) - Adjacent to Face 1 on edge x=20
      // Vertices: (20,0), (40,0), (40,10), (20,10)
      // (20,10) is on edge of Face 1 ((20,0)-(20,20))
      const w2 = createWinding(4);
      w2.points = [
        {x:20,y:10,z:0}, {x:40,y:10,z:0}, {x:40,y:0,z:0}, {x:20,y:0,z:0}
      ];

      const faces: CompileFace[] = [
        { winding: w1, planeNum: 0, texInfo: 0, contents: 0, next: null },
        { winding: w2, planeNum: 0, texInfo: 0, contents: 0, next: null }
      ];

      const fixed = fixTJunctions(faces);

      // Face 1 should now have 5 points
      // (20,10) should be inserted between (20,20) and (20,0)
      // Original order: (0,20)->(20,20)->(20,0)->(0,0)
      // New order should include (20,10) between (20,20) and (20,0)

      const f1 = fixed[0];
      expect(f1.winding.numPoints).toBe(5);

      // Check if point (20,10,0) exists
      const hasPoint = f1.winding.points.some(p =>
        Math.abs(p.x - 20) < 0.01 && Math.abs(p.y - 10) < 0.01 && Math.abs(p.z - 0) < 0.01
      );
      expect(hasPoint).toBe(true);

      // Face 2 should remain unchanged (4 points)
      const f2 = fixed[1];
      expect(f2.winding.numPoints).toBe(4);
    });
  });
});
