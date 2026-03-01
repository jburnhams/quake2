import { BspVisibility, BspVisibilityCluster } from '../types/bsp.js';
import { Portal } from './portals.js';
import { TreeLeaf } from './tree.js';

/**
 * Represents a set of bits, often used for clusters.
 * We use Uint8Array where each bit represents a cluster index.
 */
export type BitSet = Uint8Array;

export interface PortalFlow {
  portal: Portal;
  frontCluster: number;
  backCluster: number;
  mightSee: BitSet;  // Clusters this portal might see
  canSee: BitSet;    // Clusters this portal definitely sees
  status: 'pending' | 'working' | 'done';
}

export interface VisibilityState {
  numClusters: number;
  numPortals: number;
  portals: PortalFlow[];
  clusterPortals: Map<number, PortalFlow[]>;  // Portals per cluster
}

/**
 * Create a new BitSet initialized to 0.
 */
export function createBitSet(numBits: number): BitSet {
  const rowBytes = Math.ceil(numBits / 8);
  return new Uint8Array(rowBytes);
}

/**
 * Set a bit in the BitSet.
 */
export function setBit(bitSet: BitSet, index: number): void {
  bitSet[index >> 3] |= (1 << (index & 7));
}

/**
 * Check a bit in the BitSet.
 */
export function testBit(bitSet: BitSet, index: number): boolean {
  return (bitSet[index >> 3] & (1 << (index & 7))) !== 0;
}

/**
 * Copy a BitSet.
 */
export function copyBitSet(bitSet: BitSet): BitSet {
  return new Uint8Array(bitSet);
}

/**
 * Initialize portal flow structures for visibility computation
 */
export function initializePortalFlow(
  portals: Portal[],
  leafs: TreeLeaf[]
): VisibilityState {
  let numClusters = 0;
  for (const leaf of leafs) {
    if (leaf.cluster !== undefined && leaf.cluster > numClusters) {
      numClusters = leaf.cluster;
    }
  }
  numClusters++; // 0-indexed to count

  const clusterPortals = new Map<number, PortalFlow[]>();
  const flows: PortalFlow[] = [];

  for (const p of portals) {
    // Both nodes of the portal must be leaves and have valid clusters
    const fNode = p.nodes[0] as TreeLeaf;
    const bNode = p.nodes[1] as TreeLeaf;

    if (!fNode || !bNode || fNode.cluster === undefined || bNode.cluster === undefined) {
      continue;
    }

    if (fNode.cluster === bNode.cluster) {
      continue;
    }

    const flow: PortalFlow = {
      portal: p,
      frontCluster: fNode.cluster,
      backCluster: bNode.cluster,
      mightSee: createBitSet(numClusters),
      canSee: createBitSet(numClusters),
      status: 'pending'
    };

    flows.push(flow);

    // Register with front cluster
    let cpFront = clusterPortals.get(fNode.cluster);
    if (!cpFront) {
      cpFront = [];
      clusterPortals.set(fNode.cluster, cpFront);
    }
    cpFront.push(flow);

    // Register with back cluster
    let cpBack = clusterPortals.get(bNode.cluster);
    if (!cpBack) {
      cpBack = [];
      clusterPortals.set(bNode.cluster, cpBack);
    }
    cpBack.push(flow);
  }

  return {
    numClusters,
    numPortals: flows.length,
    portals: flows,
    clusterPortals
  };
}

/**
 * Compute which clusters are reachable from a given cluster
 * through portal chains (ignoring actual visibility)
 */
export function floodFillVisibility(
  state: VisibilityState,
  startCluster: number
): BitSet {
  const result = createBitSet(state.numClusters);
  const stack: number[] = [startCluster];

  setBit(result, startCluster);

  while (stack.length > 0) {
    const cluster = stack.pop()!;
    const portals = state.clusterPortals.get(cluster);

    if (!portals) continue;

    for (const flow of portals) {
      // Find the adjacent cluster
      const adjacentCluster = (flow.frontCluster === cluster) ? flow.backCluster : flow.frontCluster;

      if (!testBit(result, adjacentCluster)) {
        setBit(result, adjacentCluster);
        stack.push(adjacentCluster);
      }
    }
  }

  return result;
}

/**
 * Test if target cluster might be visible from source
 * through a chain of portals.
 *
 * This is a basic flood-fill reachability check for "fast" vis.
 */
export function mightSeeCluster(
  state: VisibilityState,
  source: number,
  target: number
): boolean {
  // If we just flood-fill from source, does it hit target?
  // Note: For performance this can be precomputed or we can
  // just use floodFillVisibility directly and check the bit.
  const reachable = floodFillVisibility(state, source);
  return testBit(reachable, target);
}

/**
 * Compress visibility bitsets using Quake 2 run-length encoding.
 * - 0x00: Next byte is count of zeroes.
 * - Other: Literal byte.
 * (Quake 2 doesn't use the 'count of ones' compression mentioned in some variants,
 * it strictly compresses zeroes according to writebsp.c)
 */
export function compressPvs(pvs: BitSet): Uint8Array {
  const result: number[] = [];
  const len = pvs.length;

  for (let i = 0; i < len; i++) {
    if (pvs[i] === 0) {
      // Find length of zeroes
      let rep = 1;
      for (let j = i + 1; j < len; j++) {
        if (pvs[j] === 0 && rep < 255) {
          rep++;
        } else {
          break;
        }
      }
      result.push(0);
      result.push(rep);
      i += (rep - 1);
    } else {
      result.push(pvs[i]);
    }
  }

  return new Uint8Array(result);
}

/**
 * Decompress a single cluster's PVS.
 */
export function decompressPvs(
  data: Uint8Array,
  offset: number,
  numClusters: number
): BitSet {
  const rowBytes = Math.ceil(numClusters / 8);
  const pvs = new Uint8Array(rowBytes);
  let pvsIndex = 0;
  let dataIndex = offset;

  while (pvsIndex < rowBytes && dataIndex < data.length) {
    if (data[dataIndex] === 0) {
      dataIndex++;
      const rep = data[dataIndex];
      dataIndex++;
      for (let i = 0; i < rep && pvsIndex < rowBytes; i++) {
        pvs[pvsIndex++] = 0;
      }
    } else {
      pvs[pvsIndex++] = data[dataIndex++];
    }
  }

  return pvs;
}

export interface VisOptions {
  fast?: boolean;
  threads?: number;
  onProgress?: (percent: number) => void;
}

export interface VisibilityData {
  numClusters: number;
  bitOffsets: number[];  // [pvs_offset, phs_offset] per cluster
  data: Uint8Array;
}

/**
 * Compute visibility with options.
 * This computes the PVS for all clusters and returns the BspVisibility structure.
 */
export function computeVisibility(
  portals: Portal[],
  leafs: TreeLeaf[],
  options?: VisOptions
): BspVisibility {
  const state = initializePortalFlow(portals, leafs);
  const numClusters = state.numClusters;

  if (numClusters <= 0) {
    return { numClusters: 0, clusters: [] };
  }

  const clusters: BspVisibilityCluster[] = [];

  for (let i = 0; i < numClusters; i++) {
    // In fast mode or simple implementation, use flood fill
    const pvs = computeClusterPvs(state, i);

    // For now, PHS is just a copy of PVS (basic impl)
    const phs = copyBitSet(pvs);

    // Compress to test that logic works, but BspVisibility requires
    // uncompressed PVS/PHS directly for the engine as per current typings,
    // though the binary write expects compressed.
    // The BspVisibility structure used in memory should hold uncompressed or compressed?
    // According to bsp.ts, BspVisibilityCluster has pvs: Uint8Array.
    // In quake 2, the lump is compressed. The engine decompresses it or reads it directly?
    // Actually, the engine reads compressed data and decompresses at runtime or load time.
    // But bsp-tools generates the lump.
    // We will supply the raw BitSet data here as that matches `generateTrivialVis`.

    clusters.push({
      pvs: pvs,
      phs: phs
    });

    if (options?.onProgress) {
      options.onProgress((i + 1) / numClusters);
    }
  }

  return {
    numClusters,
    clusters
  };
}

/**
 * Creates the binary lump data for visibility (compressed).
 * Used by bspWriter.ts or integration tests.
 */
export function createVisibilityLump(vis: BspVisibility): VisibilityData {
  const numClusters = vis.numClusters;
  const bitOffsets: number[] = [];
  const combinedData: number[] = [];

  for (let i = 0; i < numClusters; i++) {
    const cluster = vis.clusters[i];

    // Compress PVS
    const pvsCompressed = compressPvs(cluster.pvs);
    const pvsOffset = combinedData.length;
    for (let j = 0; j < pvsCompressed.length; j++) {
      combinedData.push(pvsCompressed[j]);
    }

    // Compress PHS
    const phsCompressed = compressPvs(cluster.phs);
    const phsOffset = combinedData.length;
    for (let j = 0; j < phsCompressed.length; j++) {
      combinedData.push(phsCompressed[j]);
    }

    bitOffsets.push(pvsOffset);
    bitOffsets.push(phsOffset);
  }

  return {
    numClusters,
    bitOffsets,
    data: new Uint8Array(combinedData)
  };
}

/**
 * Compute full Potentially Visible Set for a cluster (placeholder for now)
 */
export function computeClusterPvs(
  state: VisibilityState,
  cluster: number
): BitSet {
  // For basic/fast implementation, just return flood fill
  return floodFillVisibility(state, cluster);
}

/**
 * Generate trivial visibility data where every cluster can see every other cluster.
 * Used for MVP or when VIS compilation is skipped.
 */
export function generateTrivialVis(numClusters: number): BspVisibility {
  if (numClusters <= 0) {
    return { numClusters: 0, clusters: [] };
  }

  const rowBytes = Math.ceil(numClusters / 8);
  const fullVisRow = new Uint8Array(rowBytes);

  // Fill with 1s (0xFF) to indicate full visibility
  // Note: The last byte might have padding bits which should be 0, but setting them to 1 usually doesn't hurt.
  // However, standard VIS compilers leave padding bits 0.
  // Let's be precise: Set bits corresponding to valid clusters to 1.

  for (let i = 0; i < numClusters; i++) {
    const byteIndex = i >> 3;
    const bitIndex = i & 7;
    fullVisRow[byteIndex] |= (1 << bitIndex);
  }

  // Reuse the same row object since it's identical for all clusters in trivial case
  // But strictly, we should probably return new copies if mutation is expected.
  // BspVisibility types use ReadonlyArray, so reusing is fine if treated as immutable.

  const clusters: BspVisibilityCluster[] = [];
  for (let i = 0; i < numClusters; i++) {
    clusters.push({
      pvs: fullVisRow, // Shared reference is fine for read-only
      phs: fullVisRow
    });
  }

  return {
    numClusters,
    clusters
  };
}
