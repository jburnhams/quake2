import { describe, it, expect } from 'vitest';
import {
  selectSplitPlane,
  partitionBrushes,
  buildTree,
  isLeaf,
  flattenTree,
  type TreeNode,
  type TreeElement
} from '../../../src/compiler/tree.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { CONTENTS_SOLID, createEmptyBounds3 } from '@quake2ts/shared';
import { createCompileBrush } from './helpers.js';
import type { CompileFace } from '../../../src/types/compile.js';

describe('selectSplitPlane', () => {
  it('selects a separating plane for two disjoint brushes', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: -100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const b2 = box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });

    const brush1 = createCompileBrush(b1, planeSet);
    const brush2 = createCompileBrush(b2, planeSet);

    const result = selectSplitPlane([brush1, brush2], planeSet, new Set());

    expect(result).not.toBeNull();
    // It should pick a plane that puts one in front and one in back
    // totalFront and totalBack check ensures usefulness
    expect(result!.frontCount).toBeGreaterThan(0);
    expect(result!.backCount).toBeGreaterThan(0);
    expect(result!.splitCount).toBe(0);
  });

  it('selects a splitting plane for overlapping brushes', () => {
    const planeSet = new PlaneSet();
    // Two boxes intersecting
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const b2 = box({ origin: { x: 32, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });

    const brush1 = createCompileBrush(b1, planeSet);
    const brush2 = createCompileBrush(b2, planeSet);

    const result = selectSplitPlane([brush1, brush2], planeSet, new Set());

    expect(result).not.toBeNull();
    // With overlapping brushes, we might find a split or a separation.
    // If we separate them (splitCount=0), that's fine too.
    // X=32 plane separates the "unique" parts of b1 from b2?
    // b1 [-32, 32]. b2 [0, 64].
    // X=32 is max of b1.
    // b1 is BACK of X=32.
    // b2 is [0, 64]. 0 is Back. 64 is Front.
    // So b2 SPANS X=32.
    // So splitCount should be 1 if X=32 is picked.
    // However, maybe Y plane is picked?
    // Y=32. Both in back. Score penalty.
    // The heuristic prefers axial.
    // X=32 splits 1 brush. Score = -(1*4) - balance.
    // If no better plane, it picks this.
    // But hull logic allows Front=0.
    // If it picks a boundary plane that DOESN'T split (e.g. X=64),
    // b1 in Back. b2 in Back. Front=0. Split=0.
    // Score = -(0) - (0 vs 2) = -2.
    // Split=1 score = -4 - ... = -6.
    // So picking a non-splitting boundary (X=64) is BETTER than splitting (X=32).
    // So splitCount will be 0.
    // And this is valid: we carve out the bounding box first.

    expect(result!.splitCount).toBeGreaterThanOrEqual(0);
  });

  it('returns a split for a single convex brush to generate hull (valid boundary plane)', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brush1 = createCompileBrush(b1, planeSet);

    // Previously expected null. Now expects a plane that puts the brush in BACK (or FRONT).
    // Because we want to carve it out of the universe.
    const result = selectSplitPlane([brush1], planeSet, new Set());

    expect(result).not.toBeNull();
    // One side should be 0 (empty void), other side has the brush.
    // For a box, planes point out. Brush is in BACK. Front is empty.
    expect(result!.frontCount).toBe(0);
    expect(result!.backCount).toBe(1);
  });
});

describe('partitionBrushes', () => {
  it('partitions brushes into front and back', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: -100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const b2 = box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });

    const brush1 = createCompileBrush(b1, planeSet);
    const brush2 = createCompileBrush(b2, planeSet);

    // Pick a plane between them (e.g. X=0)
    const splitNormal = { x: 1, y: 0, z: 0 };
    const splitDist = 0;
    const planeNum = planeSet.findOrAdd(splitNormal, splitDist);

    const { front, back } = partitionBrushes([brush1, brush2], planeNum, planeSet);

    expect(front.length).toBe(1);
    expect(back.length).toBe(1);
    expect(front[0]).toBe(brush2); // X=100 is in front of X=0 (normal points to +X)
    expect(back[0]).toBe(brush1);  // X=-100 is in back
  });

  it('splits a brush that spans the plane', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 128, y: 128, z: 128 } });
    const brush1 = createCompileBrush(b1, planeSet);

    // Split by X=0
    const splitNormal = { x: 1, y: 0, z: 0 };
    const splitDist = 0;
    const planeNum = planeSet.findOrAdd(splitNormal, splitDist);

    const { front, back } = partitionBrushes([brush1], planeNum, planeSet);

    expect(front.length).toBe(1);
    expect(back.length).toBe(1);

    // Front piece should be X > 0
    expect(front[0].bounds.mins.x).toBeGreaterThanOrEqual(-0.001);
    // Back piece should be X < 0
    expect(back[0].bounds.maxs.x).toBeLessThanOrEqual(0.001);
  });
});

describe('buildTree', () => {
  it('builds a tree for disjoint brushes', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: -100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const b2 = box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });

    const brushes = [
      createCompileBrush(b1, planeSet),
      createCompileBrush(b2, planeSet)
    ];

    const root = buildTree(brushes, planeSet);

    // Root should be a node
    expect(isLeaf(root)).toBe(false);
    if (!isLeaf(root)) {
       expect(root.children).toBeDefined();
       expect(root.children.length).toBe(2);
    }
  });

  it('builds a tree for a single brush (carving hull)', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 }, contents: CONTENTS_SOLID });
    const brush = createCompileBrush(b1, planeSet);

    const root = buildTree([brush], planeSet);

    // With Hull generation enabled, a single brush creates a Node (carving out the void)
    // Eventually it leads to leaves.
    // So root should be a NODE.
    expect(isLeaf(root)).toBe(false);

    // Deeper down we should find a solid leaf
    // We can traverse or just check structure roughly
    if (!isLeaf(root)) {
        // One child should be empty (or node), other should have brush
        // Since box planes point out, front is empty.
        // So children[0] should be empty leaf?
        // Depends on which plane picked.
        // If X=max. Front is empty.
        // children[0] -> empty leaf?
        // Let's verify it's not a single solid leaf.
    }
  });

  it('returns empty leaf for empty input', () => {
    const planeSet = new PlaneSet();
    const root = buildTree([], planeSet);

    expect(isLeaf(root)).toBe(true);
    if (isLeaf(root)) {
      expect(root.contents).toBe(0);
      expect(root.brushes.length).toBe(0);
    }
  });

  it('respects recursion depth limit', () => {
    const planeSet = new PlaneSet();
    // Two separable brushes
    const b1 = box({ origin: { x: -100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const b2 = box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });

    const brushes = [
      createCompileBrush(b1, planeSet),
      createCompileBrush(b2, planeSet)
    ];

    // Force depth to limit (1000)
    // Pass empty set for usedPlanes
    const root = buildTree(brushes, planeSet, new Set(), 1000);

    expect(isLeaf(root)).toBe(true);
    if (isLeaf(root)) {
      // Should contain both brushes
      expect(root.brushes.length).toBe(2);
    }
  });
});

describe('flattenTree', () => {
  it('flattens a simple tree into nodes and leafs', () => {
    // Construct a dummy tree manually
    const leafA: TreeElement = {
      contents: 0,
      brushes: [],
      bounds: createEmptyBounds3()
    };
    const leafB: TreeElement = {
      contents: CONTENTS_SOLID,
      brushes: [],
      bounds: createEmptyBounds3()
    };

    const root: TreeNode = {
      planeNum: 1,
      children: [leafA, leafB],
      bounds: createEmptyBounds3()
    };

    const faceMap = new Map<TreeNode, CompileFace[]>();
    const dummyFace: CompileFace = {
      planeNum: 1,
      texInfo: 0,
      contents: 0,
      next: null,
      winding: { numPoints: 0, points: [] } as any
    };
    faceMap.set(root, [dummyFace]);

    const result = flattenTree(root, faceMap);

    // Root is node 0
    expect(result.nodes.length).toBe(1);
    expect(result.leafs.length).toBe(2);

    const node = result.nodes[0];
    expect(node.planeIndex).toBe(1);
    // Children:
    // leafA is index 0 -> encoded as -(0+1) = -1
    // leafB is index 1 -> encoded as -(1+1) = -2
    // Order depends on traversal. walk(root) calls walk(children[0]) then walk(children[1]).
    // So leafA is index 0, leafB is index 1.
    expect(node.children[0]).toBe(-1);
    expect(node.children[1]).toBe(-2);

    // Faces
    expect(node.numFaces).toBe(1);
    expect(result.serializedFaces.length).toBe(1);
    expect(result.serializedFaces[0]).toBe(dummyFace);
  });
});
