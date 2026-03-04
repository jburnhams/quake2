import { describe, it, expect } from 'vitest';
import { initializePortalFlow, floodFillVisibility, mightSeeCluster, BitSet, compressPvs, decompressPvs, createVisibilityLump, computePhs, computeClusterPvs, computeVisibility, clipToAntiPenumbra } from '../../../src/compiler/vis.js';
import { Portal } from '../../../src/compiler/portals.js';
import { TreeLeaf } from '../../../src/compiler/tree.js';
import { createEmptyBounds3, baseWindingForPlane } from '@quake2ts/shared';

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

  it('computes recursive cluster PVS', () => {
    // Basic test matching the flood fill case as our current MVP PVS
    // acts similarly. We mock the `mightSee` behavior slightly.
    const leafA: TreeLeaf = { contents: 0, cluster: 0, brushes: [], bounds: createEmptyBounds3() };
    const leafB: TreeLeaf = { contents: 0, cluster: 1, brushes: [], bounds: createEmptyBounds3() };
    const leafC: TreeLeaf = { contents: 0, cluster: 2, brushes: [], bounds: createEmptyBounds3() };

    const baseW = baseWindingForPlane({x:1, y:0, z:0}, 0);

    const portalAB: any = { nodes: [leafA, leafB], winding: baseW };
    const portalBC: any = { nodes: [leafB, leafC], winding: baseW };

    const portals: Portal[] = [portalAB, portalBC];
    const state = initializePortalFlow(portals, 3);

    // Simulate that flood fill already populated mightSee
    // Populate mightSee for each flow to realistically test PVS computation
    for (const flow of state.portals) {
      flow.mightSee = floodFillVisibility(state, flow.backCluster);
    }

    const pvsA = computeClusterPvs(state, 0);
    expect(pvsA.get(0)).toBe(true);
    expect(pvsA.get(1)).toBe(true);
    expect(pvsA.get(2)).toBe(true); // Can see C through B in our simple pass-through MVP
  });

  it('computes PHS', () => {
    const numClusters = 4;
    const pvsBits: BitSet[] = [];

    // 0 sees 1
    // 1 sees 2
    // 2 sees 3
    // 3 sees nothing
    for (let i = 0; i < numClusters; i++) {
       const row = new BitSet(numClusters);
       row.set(i);
       if (i + 1 < numClusters) {
           row.set(i + 1);
       }
       pvsBits.push(row);
    }

    const phsBits = computePhs(pvsBits, numClusters);

    // 0 PVS is [0, 1]. PHS expands to include everything 1 can see ([1, 2]) -> [0, 1, 2]
    expect(phsBits[0].get(0)).toBe(true);
    expect(phsBits[0].get(1)).toBe(true);
    expect(phsBits[0].get(2)).toBe(true);
    expect(phsBits[0].get(3)).toBe(false); // 1 cannot see 3, so 0 cannot hear 3

    // 1 PVS is [1, 2]. PHS expands to [1, 2, 3]
    expect(phsBits[1].get(0)).toBe(false);
    expect(phsBits[1].get(1)).toBe(true);
    expect(phsBits[1].get(2)).toBe(true);
    expect(phsBits[1].get(3)).toBe(true);
  });

  it('runs computeVisibility in fast mode', () => {
    const leafA: TreeLeaf = { contents: 0, cluster: 0, brushes: [], bounds: createEmptyBounds3() };
    const leafB: TreeLeaf = { contents: 0, cluster: 1, brushes: [], bounds: createEmptyBounds3() };

    const portalAB: any = { nodes: [leafA, leafB], winding: baseWindingForPlane({x:1, y:0, z:0}, 0) };

    let progressFired = false;
    const result = computeVisibility([portalAB], 2, {
        fast: true,
        onProgress: (p) => { progressFired = true; }
    });

    expect(progressFired).toBe(true);
    expect(result.numClusters).toBe(2);
    // 0 sees 1, 1 sees 0
    expect(decompressPvs(result.clusters[0].pvs, 0, 2).get(1)).toBe(true);
    expect(decompressPvs(result.clusters[1].pvs, 0, 2).get(0)).toBe(true);
  });

  it('clipToAntiPenumbra returns correctly in MVP mode', () => {
      const w1 = baseWindingForPlane({x:1, y:0, z:0}, 0);
      const w2 = baseWindingForPlane({x:0, y:1, z:0}, 0);
      const w3 = baseWindingForPlane({x:0, y:0, z:1}, 0);

      const res = clipToAntiPenumbra(w1!, w2!, w3!);

      expect(res).toBeDefined();
      expect(res!.numPoints).toBe(w3!.numPoints);
  });
});

describe('Visibility Output', () => {
  it('creates visibility lump data structure', () => {
    const numClusters = 4;

    // Create raw uncompressed bitsets for PVS and PHS
    const pvs: BitSet[] = [];
    const phs: BitSet[] = [];

    for (let i = 0; i < numClusters; i++) {
      const pvsBits = new BitSet(numClusters);
      const phsBits = new BitSet(numClusters);

      pvsBits.set(i); // Node i can see itself
      if (i < numClusters - 1) pvsBits.set(i + 1); // Node i can see i+1

      phsBits.setAll(); // Can hear everything

      pvs.push(pvsBits);
      phs.push(phsBits);
    }

    const lump = createVisibilityLump(pvs, phs, numClusters);

    expect(lump.numClusters).toBe(numClusters);
    expect(lump.clusters.length).toBe(numClusters);

    for (let i = 0; i < numClusters; i++) {
      // Decompress PVS and PHS back to verify correct formatting
      const decompressedPvs = decompressPvs(lump.clusters[i].pvs, 0, numClusters);
      const decompressedPhs = decompressPvs(lump.clusters[i].phs, 0, numClusters);

      expect(decompressedPvs.get(i)).toBe(true);
      if (i < numClusters - 1) expect(decompressedPvs.get(i + 1)).toBe(true);

      for (let j = 0; j < numClusters; j++) {
        expect(decompressedPhs.get(j)).toBe(true);
      }
    }
  });

  it('handles empty cluster visibility creation', () => {
    const lump = createVisibilityLump([], [], 0);
    expect(lump.numClusters).toBe(0);
    expect(lump.clusters.length).toBe(0);
  });
});

describe('PVS Compression', () => {
  it('compresses and decompresses correctly', () => {
    const numClusters = 40; // 5 bytes
    const bits = new BitSet(numClusters);

    // Set some bits
    bits.set(0);
    bits.set(10);
    bits.set(11);
    bits.set(39);

    const uncompressed = bits.data;

    // Ensure we have some zeroes in between to trigger RLE compression
    expect(uncompressed[2]).toBe(0);
    expect(uncompressed[3]).toBe(0);

    const compressed = compressPvs(uncompressed);

    // Decompress and verify
    const decompressed = decompressPvs(compressed, 0, numClusters);

    for (let i = 0; i < uncompressed.length; i++) {
      expect(decompressed.data[i]).toBe(uncompressed[i]);
    }

    expect(decompressed.get(0)).toBe(true);
    expect(decompressed.get(10)).toBe(true);
    expect(decompressed.get(11)).toBe(true);
    expect(decompressed.get(39)).toBe(true);
    expect(decompressed.get(1)).toBe(false);
  });

  it('compresses empty PVS efficiently', () => {
    const numClusters = 200; // 25 bytes
    const bits = new BitSet(numClusters);

    const compressed = compressPvs(bits.data);

    // RLE compression for 25 zeroes should be 0x00, 0x19
    expect(compressed.length).toBe(2);
    expect(compressed[0]).toBe(0);
    expect(compressed[1]).toBe(25);

    const decompressed = decompressPvs(compressed, 0, numClusters);
    for (let i = 0; i < numClusters; i++) {
      expect(decompressed.get(i)).toBe(false);
    }
  });

  it('compresses full PVS efficiently', () => {
    const numClusters = 40; // 5 bytes
    const bits = new BitSet(numClusters);
    bits.setAll();

    const compressed = compressPvs(bits.data);

    // No zeroes, so it should just copy literal bytes
    expect(compressed.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(compressed[i]).toBe(0xFF);
    }
  });
});
