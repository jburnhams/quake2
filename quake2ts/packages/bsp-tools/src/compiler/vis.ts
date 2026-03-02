import { BspVisibility, BspVisibilityCluster } from '../types/bsp.js';
import { Portal } from './portals.js';
import { TreeLeaf, isLeaf } from './tree.js';

/**
 * A simple BitSet implementation over a Uint8Array for visibility matrices.
 */
export class BitSet {
  public data: Uint8Array;
  public size: number;

  constructor(size: number) {
    this.size = size;
    const rowBytes = Math.ceil(size / 8);
    this.data = new Uint8Array(rowBytes);
  }

  set(index: number) {
    if (index >= this.size || index < 0) return;
    const byteIndex = index >> 3;
    const bitIndex = index & 7;
    this.data[byteIndex] |= (1 << bitIndex);
  }

  clear(index: number) {
    if (index >= this.size || index < 0) return;
    const byteIndex = index >> 3;
    const bitIndex = index & 7;
    this.data[byteIndex] &= ~(1 << bitIndex);
  }

  get(index: number): boolean {
    if (index >= this.size || index < 0) return false;
    const byteIndex = index >> 3;
    const bitIndex = index & 7;
    return (this.data[byteIndex] & (1 << bitIndex)) !== 0;
  }

  setAll() {
    this.data.fill(0xFF);
    // Clear trailing bits if size is not a multiple of 8
    const remainder = this.size & 7;
    if (remainder !== 0) {
      const mask = (1 << remainder) - 1;
      this.data[this.data.length - 1] &= mask;
    }
  }

  clearAll() {
    this.data.fill(0);
  }
}

/**
 * Data structure tracking visibility from a single portal into the BSP.
 * Replaces complex recursive state passed down vis algorithm branches.
 *
 * Reference: q2tools/src/vis.c (vportal_t structure and usage)
 */
export interface PortalFlow {
  portal: Portal;
  frontCluster: number;
  backCluster: number;
  mightSee: BitSet;  // Clusters this portal might potentially see (flood-filled)
  canSee: BitSet;    // Clusters this portal definitely sees (geometrically proven)
  status: 'pending' | 'working' | 'done';
}

/**
 * Stores the global state for the visibility compilation pass.
 */
export interface VisibilityState {
  numClusters: number;
  numPortals: number;
  portals: PortalFlow[];
  clusterPortals: Map<number, PortalFlow[]>;  // Portals bounding a specific cluster
}

/**
 * Initializes portal flow structures for visibility computation.
 * Converts geometric portals into directed flow vectors.
 *
 * Reference: q2tools/src/vis.c (BasePortalVis equivalent setup)
 */
export function initializePortalFlow(
  portals: Portal[],
  numClusters: number
): VisibilityState {
  const portalFlows: PortalFlow[] = [];
  const clusterPortals = new Map<number, PortalFlow[]>();

  for (let i = 0; i < numClusters; i++) {
    clusterPortals.set(i, []);
  }

  for (const portal of portals) {
    const frontNode = portal.nodes[0];
    const backNode = portal.nodes[1];

    if (!isLeaf(frontNode) || !isLeaf(backNode)) {
      continue;
    }

    // Nodes must be valid leaves and have an assigned cluster.
    if (
      frontNode.cluster !== undefined && frontNode.cluster >= 0 &&
      backNode.cluster !== undefined && backNode.cluster >= 0
    ) {
      // Create flow from front to back
      const flowForward: PortalFlow = {
        portal,
        frontCluster: frontNode.cluster,
        backCluster: backNode.cluster,
        mightSee: new BitSet(numClusters),
        canSee: new BitSet(numClusters),
        status: 'pending'
      };

      // Create flow from back to front
      const flowBackward: PortalFlow = {
        portal,
        frontCluster: backNode.cluster,
        backCluster: frontNode.cluster,
        mightSee: new BitSet(numClusters),
        canSee: new BitSet(numClusters),
        status: 'pending'
      };

      portalFlows.push(flowForward, flowBackward);
      clusterPortals.get(frontNode.cluster)?.push(flowForward);
      clusterPortals.get(backNode.cluster)?.push(flowBackward);
    }
  }

  return {
    numClusters,
    numPortals: portalFlows.length,
    portals: portalFlows,
    clusterPortals
  };
}

/**
 * Computes which clusters are reachable from a given cluster
 * through portal chains (ignoring actual geometric visibility constraints).
 *
 * Used as an initial fast-pass "might see" check. If flood fill cannot
 * reach a cluster, expensive geometry tests are skipped.
 *
 * Reference: q2tools/src/vis.c (BasePortalVis flood-fill)
 */
export function floodFillVisibility(
  state: VisibilityState,
  startCluster: number
): BitSet {
  const reachable = new BitSet(state.numClusters);
  const queue: number[] = [startCluster];
  reachable.set(startCluster);

  let head = 0;
  while (head < queue.length) {
    const cluster = queue[head++];
    const flows = state.clusterPortals.get(cluster) || [];

    for (const flow of flows) {
      if (!reachable.get(flow.backCluster)) {
        reachable.set(flow.backCluster);
        queue.push(flow.backCluster);
      }
    }
  }

  return reachable;
}

/**
 * Tests if the target cluster might potentially be visible from the source
 * through a chain of portals (basic topological check).
 *
 * In a fully optimized implementation, this references the `mightSee` pre-calculated
 * bitmask on flows. For simplicity in early phases, a flood fill is performed.
 */
export function mightSeeCluster(
  state: VisibilityState,
  source: number,
  target: number
): boolean {
  // If we pre-computed base visibility across all portals, this could use flow.mightSee
  // Here we do an on-demand simple flood fill test for MVP base connectivity.
  const reachable = floodFillVisibility(state, source);
  return reachable.get(target);
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
