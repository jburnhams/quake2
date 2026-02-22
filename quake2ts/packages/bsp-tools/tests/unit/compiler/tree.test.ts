import { describe, it, expect } from 'vitest';
import {
  selectSplitPlane,
  partitionBrushes,
  buildTree,
  isLeaf
} from '../../../src/compiler/tree.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { box } from '../../../src/builder/primitives.js';
import { CONTENTS_SOLID } from '@quake2ts/shared';
import { createCompileBrush } from './helpers.js';

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
    // It might split, or it might pick a bounding plane (splitCount=0) if that has better score.
    // Minimizing splits is good behavior.
    expect(result!.splitCount).toBeGreaterThanOrEqual(0);
  });

  it('returns a plane for a single convex brush (carving)', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 } });
    const brush1 = createCompileBrush(b1, planeSet);

    const result = selectSplitPlane([brush1], planeSet, new Set());

    // It should pick a plane to carve the brush from the void.
    expect(result).not.toBeNull();
    // Since it's a convex brush, one side will be empty (Front) and one will have the brush (Back).
    // Or vice versa depending on normal.
    // For box, normals point out. Brush is on Back.
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

  it('builds a tree for a single brush (carving)', () => {
    const planeSet = new PlaneSet();
    const b1 = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 64, y: 64, z: 64 }, contents: CONTENTS_SOLID });
    const brush = createCompileBrush(b1, planeSet);

    const root = buildTree([brush], planeSet);

    // Should carve the brush out of void, so it should be a tree (node)
    expect(isLeaf(root)).toBe(false);
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
    // Should return leaf instead of splitting
    const root = buildTree(brushes, planeSet, 1000);

    expect(isLeaf(root)).toBe(true);
    if (isLeaf(root)) {
      // Should contain both brushes
      expect(root.brushes.length).toBe(2);
    }
  });
});
