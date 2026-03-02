import { describe, it, expect } from 'vitest';
import { initializePortalFlow, floodFillVisibility, mightSeeCluster, BitSet } from '../../../src/compiler/vis.js';
import { Portal } from '../../../src/compiler/portals.js';
import { TreeLeaf } from '../../../src/compiler/tree.js';
import { createEmptyBounds3 } from '@quake2ts/shared';

describe('Visibility Flow', () => {
  it('BitSet functions correctly', () => {
    const bits = new BitSet(10);
    expect(bits.size).toBe(10);
    expect(bits.get(0)).toBe(false);

    bits.set(3);
    bits.set(8);
    expect(bits.get(3)).toBe(true);
    expect(bits.get(8)).toBe(true);
    expect(bits.get(7)).toBe(false);

    bits.clear(3);
    expect(bits.get(3)).toBe(false);

    bits.setAll();
    expect(bits.get(0)).toBe(true);
    expect(bits.get(9)).toBe(true);
    expect(bits.get(10)).toBe(false); // Out of bounds

    bits.clearAll();
    expect(bits.get(5)).toBe(false);
  });

  it('initializes portal flows and performs flood fill', () => {
    // 3 clusters in a row: A <-> B <-> C
    const leafA: TreeLeaf = { contents: 0, cluster: 0, brushes: [], bounds: createEmptyBounds3() };
    const leafB: TreeLeaf = { contents: 0, cluster: 1, brushes: [], bounds: createEmptyBounds3() };
    const leafC: TreeLeaf = { contents: 0, cluster: 2, brushes: [], bounds: createEmptyBounds3() };

    const portalAB: any = { nodes: [leafA, leafB] };
    const portalBC: any = { nodes: [leafB, leafC] };

    const portals: Portal[] = [portalAB, portalBC];
    const state = initializePortalFlow(portals, 3);

    expect(state.numClusters).toBe(3);
    // 2 portals = 4 directed flows
    expect(state.numPortals).toBe(4);

    // Check flows for cluster 0 (A -> B)
    const flowsA = state.clusterPortals.get(0)!;
    expect(flowsA.length).toBe(1);
    expect(flowsA[0].backCluster).toBe(1);

    // Flood fill from A
    const reachableA = floodFillVisibility(state, 0);
    expect(reachableA.get(0)).toBe(true); // self
    expect(reachableA.get(1)).toBe(true); // B
    expect(reachableA.get(2)).toBe(true); // C (transitively)

    // Flood fill from C
    const reachableC = floodFillVisibility(state, 2);
    expect(reachableC.get(0)).toBe(true); // A
    expect(reachableC.get(1)).toBe(true); // B
    expect(reachableC.get(2)).toBe(true); // self

    expect(mightSeeCluster(state, 0, 2)).toBe(true);
  });

  it('handles isolated clusters in flood fill', () => {
    // A <-> B, C isolated
    const leafA: TreeLeaf = { contents: 0, cluster: 0, brushes: [], bounds: createEmptyBounds3() };
    const leafB: TreeLeaf = { contents: 0, cluster: 1, brushes: [], bounds: createEmptyBounds3() };
    const leafC: TreeLeaf = { contents: 0, cluster: 2, brushes: [], bounds: createEmptyBounds3() };

    const portalAB: any = { nodes: [leafA, leafB] };
    const state = initializePortalFlow([portalAB], 3);

    const reachableA = floodFillVisibility(state, 0);
    expect(reachableA.get(0)).toBe(true);
    expect(reachableA.get(1)).toBe(true);
    expect(reachableA.get(2)).toBe(false);

    expect(mightSeeCluster(state, 0, 2)).toBe(false);
  });
});
