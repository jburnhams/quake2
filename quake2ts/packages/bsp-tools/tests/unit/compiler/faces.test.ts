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
import type { TreeElement, TreeNode, TreeLeaf } from '../../../src/compiler/tree';
import { PlaneSet } from '../../../src/compiler/planes';

describe('faces', () => {
  describe('extractFaces', () => {
    it('extracts faces that end up in empty leaves', () => {
      // Setup:
      // 1. PlaneSet with one plane (Z=0, normal=0,0,1)
      const planeSet = new PlaneSet();
      const planeIdx = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0); // Z > 0

      // 2. Tree with one split (Z=0).
      // Front child: Empty leaf
      // Back child: Solid leaf
      const emptyLeaf: TreeLeaf = {
        contents: 0,
        brushes: [],
        bounds: createEmptyBounds3()
      };
      const solidLeaf: TreeLeaf = {
        contents: CONTENTS_SOLID,
        brushes: [],
        bounds: createEmptyBounds3()
      };

      const root: TreeNode = {
        planeNum: planeIdx,
        children: [emptyLeaf, solidLeaf], // Front (Z>0) is empty, Back (Z<0) is solid
        bounds: createEmptyBounds3()
      };

      // 3. Brush with a face on Z=0 plane.
      // Face winding: Square on Z=0, normal=0,0,1.
      // This face is on the plane.
      // It points towards Z>0 (Front).
      // So it should be visible (facing empty space).

      const w: Winding = {
        numPoints: 4,
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 }
        ]
      };

      const brush: CompileBrush = {
        original: { contents: CONTENTS_SOLID } as any,
        sides: [
          {
            planeNum: planeIdx,
            texInfo: 0,
            winding: w,
            visible: true,
            tested: false,
            bevel: false
          }
        ],
        bounds: createEmptyBounds3(),
        next: null
      };

      const extracted = extractFaces(root, [brush], planeSet);

      expect(extracted.length).toBe(1);
      expect(extracted[0].winding).toBeDefined();
      expect(extracted[0].planeNum).toBe(planeIdx);
    });

    it('discards faces that end up in solid leaves', () => {
      // Setup similar to above, but swap leaves so Front is Solid.
      const planeSet = new PlaneSet();
      const planeIdx = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0);

      const emptyLeaf: TreeLeaf = { contents: 0, brushes: [], bounds: createEmptyBounds3() };
      const solidLeaf: TreeLeaf = { contents: CONTENTS_SOLID, brushes: [], bounds: createEmptyBounds3() };

      // Front (Z>0) is Solid, Back (Z<0) is Empty.
      const root: TreeNode = {
        planeNum: planeIdx,
        children: [solidLeaf, emptyLeaf],
        bounds: createEmptyBounds3()
      };

      // Brush face on Z=0, normal=0,0,1.
      // Points towards Z>0 (Solid).
      // So it faces into a solid -> should be discarded (hidden).

      const w: Winding = {
        numPoints: 4,
        points: [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:1,y:1,z:0}, {x:0,y:1,z:0}]
      };

      const brush: CompileBrush = {
        original: { contents: CONTENTS_SOLID } as any,
        sides: [{ planeNum: planeIdx, texInfo: 0, winding: w, visible: true, tested: false, bevel: false }],
        bounds: createEmptyBounds3(),
        next: null
      };

      const extracted = extractFaces(root, [brush], planeSet);

      expect(extracted.length).toBe(0);
    });
  });

  describe('assignFacesToNodes', () => {
    it('assigns face to node if coplanar', () => {
      const planeSet = new PlaneSet();
      const planeIdx = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0);

      const emptyLeaf: TreeLeaf = { contents: 0, brushes: [], bounds: createEmptyBounds3() };
      const root: TreeNode = {
        planeNum: planeIdx,
        children: [emptyLeaf, emptyLeaf],
        bounds: createEmptyBounds3()
      };

      const w: Winding = {
        numPoints: 4,
        points: [{x:0,y:0,z:0}, {x:1,y:0,z:0}, {x:1,y:1,z:0}, {x:0,y:1,z:0}]
      };

      const face: CompileFace = {
        planeNum: planeIdx,
        side: 0,
        texInfo: 0,
        winding: w,
        contents: 0,
        next: null
      };

      const assignment = assignFacesToNodes([face], root, planeSet);

      expect(assignment.has(root)).toBe(true);
      expect(assignment.get(root)!.length).toBe(1);
      expect(assignment.get(root)![0]).toBe(face);
    });

    it('splits face if crossing node plane and assigns to children', () => {
      const planeSet = new PlaneSet();
      // Split plane at X=0
      const planeIdx = planeSet.findOrAdd({ x: 1, y: 0, z: 0 }, 0);

      const emptyLeaf: TreeLeaf = { contents: 0, brushes: [], bounds: createEmptyBounds3() };

      // Child nodes (just leaves for simplicity)
      const root: TreeNode = {
        planeNum: planeIdx,
        children: [emptyLeaf, emptyLeaf],
        bounds: createEmptyBounds3()
      };

      // Face on Z=0 plane (normal=0,0,1), crossing X=0.
      // From X=-1 to X=1.
      const w: Winding = {
        numPoints: 4,
        points: [
          { x: -1, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: -1, y: 1, z: 0 }
        ]
      };

      // Face plane is Z=0. Node plane is X=0. They are perpendicular (SIDE_CROSS).
      const facePlaneIdx = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0);

      const face: CompileFace = {
        planeNum: facePlaneIdx,
        side: 0,
        texInfo: 0,
        winding: w,
        contents: 0,
        next: null
      };

      // assignFacesToNodes should split this face against X=0.
      // Front part (X>0) goes to front child (leaf).
      // Back part (X<0) goes to back child (leaf).
      // Since children are leaves, the faces are NOT assigned to them in the map (it maps TreeNode -> Face[]).
      // So map should be empty for root?
      // Or if we had child nodes...

      const assignment = assignFacesToNodes([face], root, planeSet);

      // The face is NOT on the root plane, so it's not assigned to root.
      expect(assignment.has(root)).toBe(false);

      // If we make children nodes, they should receive the fragments.
      const childPlaneIdx = planeSet.findOrAdd({ x: 0, y: 0, z: 1 }, 0); // Z=0 plane

      const frontNode: TreeNode = { planeNum: childPlaneIdx, children: [emptyLeaf, emptyLeaf], bounds: createEmptyBounds3() };
      const backNode: TreeNode = { planeNum: childPlaneIdx, children: [emptyLeaf, emptyLeaf], bounds: createEmptyBounds3() };

      const rootWithNodes: TreeNode = {
        planeNum: planeIdx,
        children: [frontNode, backNode],
        bounds: createEmptyBounds3()
      };

      const assignment2 = assignFacesToNodes([face], rootWithNodes, planeSet);

      // The fragments of the face should land on frontNode and backNode because they are coplanar with Z=0.
      expect(assignment2.has(frontNode)).toBe(true);
      expect(assignment2.has(backNode)).toBe(true);

      expect(assignment2.get(frontNode)!.length).toBe(1);
      expect(assignment2.get(backNode)!.length).toBe(1);
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

      const tl: Winding = {
        numPoints: 4,
        points: [{x:0,y:2,z:0}, {x:1,y:2,z:0}, {x:1,y:1,z:0}, {x:0,y:1,z:0}]
      };
      const tr: Winding = {
        numPoints: 4,
        points: [{x:1,y:2,z:0}, {x:2,y:2,z:0}, {x:2,y:1,z:0}, {x:1,y:1,z:0}]
      };
      const bl: Winding = {
        numPoints: 4,
        points: [{x:0,y:1,z:0}, {x:1,y:1,z:0}, {x:1,y:0,z:0}, {x:0,y:0,z:0}]
      };
      const br: Winding = {
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
      const f1: CompileFace = {
        winding: createWinding(4),
        planeNum: 0,
        side: 0,
        texInfo: 0,
        contents: 0,
        next: null
      };
      const f2: CompileFace = {
        winding: createWinding(4),
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
});
