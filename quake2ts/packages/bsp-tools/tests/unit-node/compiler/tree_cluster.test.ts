import { describe, it, expect } from 'vitest';
import { flattenTree, type TreeNode, type TreeElement, type TreeLeaf } from '../../../src/compiler/tree.js';
import { CONTENTS_SOLID, createEmptyBounds3 } from '@quake2ts/shared';

describe('flattenTree cluster assignment', () => {
  it('assigns incrementing clusters to non-solid leaves and -1 to solid leaves', () => {
    const leafEmpty1: TreeLeaf = {
      contents: 0,
      brushes: [],
      bounds: createEmptyBounds3(),
      portals: []
    };
    const leafSolid: TreeLeaf = {
      contents: CONTENTS_SOLID,
      brushes: [],
      bounds: createEmptyBounds3(),
      portals: []
    };
    const leafEmpty2: TreeLeaf = {
      contents: 0,
      brushes: [],
      bounds: createEmptyBounds3(),
      portals: []
    };

    const root: TreeNode = {
      planeNum: 1,
      children: [
        leafEmpty1,
        {
          planeNum: 2,
          children: [leafSolid, leafEmpty2],
          bounds: createEmptyBounds3()
        } as TreeNode
      ],
      bounds: createEmptyBounds3()
    };

    const result = flattenTree(root, new Map());

    expect(result.leafs.length).toBe(3);

    // In walk order, the leaves are:
    // 1. leafEmpty1 (contents 0) -> should get cluster 0
    // 2. leafSolid (contents CONTENTS_SOLID) -> should get cluster -1
    // 3. leafEmpty2 (contents 0) -> should get cluster 1

    expect(result.leafs[0].cluster).toBe(0);
    expect(result.leafs[1].cluster).toBe(-1);
    expect(result.leafs[2].cluster).toBe(1);

    expect(leafEmpty1.cluster).toBe(0);
    expect(leafSolid.cluster).toBe(-1);
    expect(leafEmpty2.cluster).toBe(1);
  });
});
