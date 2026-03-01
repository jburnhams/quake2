import { describe, it, expect } from 'vitest';
import {
  initializePortalFlow,
  floodFillVisibility,
  mightSeeCluster,
  createBitSet,
  setBit,
  testBit,
  compressPvs,
  decompressPvs
} from '../../../src/compiler/vis.js';
import { Portal } from '../../../src/compiler/portals.js';
import { TreeLeaf } from '../../../src/compiler/tree.js';
// To avoid circular dependency while testing internals of bsp-tools
// we redefine local copies of mock creators or use standard mock factories.
// However, memory instruction explicitly states:
// "Unit tests within @quake2ts/bsp-tools must not import from @quake2ts/test-utils to avoid circular dependencies; shared test helpers like createCompileBrush and createDummyBrush are duplicated locally (e.g., tests/unit/compiler/helpers.ts) for this package."
// I will keep the local functions here for bsp-tools tests but the exported ones are now available in test-utils for engine/integration tests.

describe('vis tools', () => {

  function createMockLeaf(cluster: number): TreeLeaf {
    return {
      contents: 0,
      bounds: {
        mins: { x: 0, y: 0, z: 0 },
        maxs: { x: 10, y: 10, z: 10 }
      },
      brushes: [],
      portals: [],
      cluster: cluster
    };
  }

  function createMockPortal(frontCluster: number, backCluster: number): Portal {
    const fNode = createMockLeaf(frontCluster);
    const bNode = createMockLeaf(backCluster);
    return {
      winding: { points: [], numPoints: 0 },
      planeNum: 0,
      onNode: null,
      nodes: [fNode, bNode],
      next: [null, null]
    };
  }

  it('create and test bitset', () => {
    const bs = createBitSet(10);
    expect(bs.length).toBe(2); // 10 bits fits in 2 bytes
    expect(testBit(bs, 5)).toBe(false);
    setBit(bs, 5);
    expect(testBit(bs, 5)).toBe(true);
    expect(testBit(bs, 6)).toBe(false);
  });

  it('initializes portal flow and connects clusters', () => {
    // 0 connected to 1, 1 connected to 2
    const portals = [
      createMockPortal(0, 1),
      createMockPortal(1, 2)
    ];

    const leafs = [
      createMockLeaf(0),
      createMockLeaf(1),
      createMockLeaf(2)
    ];

    const state = initializePortalFlow(portals, leafs);

    expect(state.numClusters).toBe(3);
    expect(state.numPortals).toBe(2);
    expect(state.clusterPortals.get(0)?.length).toBe(1);
    expect(state.clusterPortals.get(1)?.length).toBe(2); // connect to 0 and 2
    expect(state.clusterPortals.get(2)?.length).toBe(1);
  });

  it('calculates flood fill visibility correctly', () => {
    // Linear path: 0 - 1 - 2
    // Disconnected: 3
    const portals = [
      createMockPortal(0, 1),
      createMockPortal(1, 2)
    ];

    const leafs = [
      createMockLeaf(0),
      createMockLeaf(1),
      createMockLeaf(2),
      createMockLeaf(3) // Disconnected
    ];

    const state = initializePortalFlow(portals, leafs);

    const reach0 = floodFillVisibility(state, 0);
    expect(testBit(reach0, 0)).toBe(true);
    expect(testBit(reach0, 1)).toBe(true);
    expect(testBit(reach0, 2)).toBe(true);
    expect(testBit(reach0, 3)).toBe(false);

    const reach3 = floodFillVisibility(state, 3);
    expect(testBit(reach3, 0)).toBe(false);
    expect(testBit(reach3, 3)).toBe(true); // Can see itself
  });

  it('checks if cluster might see another cluster', () => {
    // 0 - 1 - 2
    const portals = [
      createMockPortal(0, 1),
      createMockPortal(1, 2)
    ];

    const leafs = [
      createMockLeaf(0),
      createMockLeaf(1),
      createMockLeaf(2),
      createMockLeaf(3)
    ];

    const state = initializePortalFlow(portals, leafs);

    expect(mightSeeCluster(state, 0, 1)).toBe(true);
    expect(mightSeeCluster(state, 0, 2)).toBe(true);
    expect(mightSeeCluster(state, 0, 3)).toBe(false);
  });

  it('compresses and decompresses PVS back to original', () => {
    // 32 clusters = 4 bytes
    const numClusters = 32;
    const original = createBitSet(numClusters);

    // Set some random bits
    setBit(original, 0);
    setBit(original, 5);
    setBit(original, 31);

    const compressed = compressPvs(original);
    const decompressed = decompressPvs(compressed, 0, numClusters);

    for (let i = 0; i < original.length; i++) {
      expect(decompressed[i]).toBe(original[i]);
    }
  });

  it('compression reduces size for sparse PVS', () => {
    const numClusters = 128; // 16 bytes
    const pvs = createBitSet(numClusters);
    // Only the first bit is visible, remaining 15 bytes are zero
    setBit(pvs, 0);

    const compressed = compressPvs(pvs);
    // Expected size: 1 literal byte, then 1 zero-compression block (0, 15) -> total 3 bytes
    expect(compressed.length).toBeLessThan(pvs.length);
    expect(compressed.length).toBe(3);
  });

  it('empty PVS compresses well', () => {
    const numClusters = 256; // 32 bytes
    const pvs = createBitSet(numClusters);

    const compressed = compressPvs(pvs);
    // Expected size: 0 (marker), 32 (count) = 2 bytes
    expect(compressed.length).toBe(2);
    expect(compressed[0]).toBe(0);
    expect(compressed[1]).toBe(32);

    const decompressed = decompressPvs(compressed, 0, numClusters);
    for (let i = 0; i < pvs.length; i++) {
      expect(decompressed[i]).toBe(0);
    }
  });
});
