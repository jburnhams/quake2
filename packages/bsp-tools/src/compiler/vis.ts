import { BspVisibility, BspVisibilityCluster } from '../types/bsp.js';
import { Winding, copyWinding, splitWinding, dotVec3 } from '@quake2ts/shared';
import { ON_EPSILON } from '../types/index.js';
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
/**
 * Recursively traces visibility through portals to build the exact PVS.
 *
 * @param state Global visibility state.
 * @param portal The target portal we are flowing into.
 * @param pvs The BitSet collecting all visible clusters from the original source.
 */
/**
 * Recursively traces visibility through portals to build the exact PVS.
 *
 * @param state Global visibility state.
 * @param portal The target portal we are flowing into.
 * @param sourceWinding The original source portal winding.
 * @param passWinding The current tight view frustum winding at the previous portal.
 * @param pvs The BitSet collecting all visible clusters from the original source.
 */
function recursiveLeafFlow(
  state: VisibilityState,
  portal: PortalFlow,
  sourceWinding: Winding,
  passWinding: Winding,
  pvs: BitSet
) {
  // Add the back cluster of this portal to the PVS
  pvs.set(portal.backCluster);

  // Look at all portals exiting the back cluster
  const nextFlows = state.clusterPortals.get(portal.backCluster) || [];

  for (const nextFlow of nextFlows) {
    if (!pvs.get(nextFlow.backCluster)) {
      if (portal.mightSee.get(nextFlow.backCluster)) {
          // Check if we are checking the direct neighbor (first step).
          // If the pass winding is exactly the source winding, we can just flow through.
          if (passWinding === sourceWinding) {
            // When moving to the next neighbor, its "pass winding" initially is just its portal winding itself.
            let pass = clipToAntiPenumbra(sourceWinding, sourceWinding, nextFlow.portal.winding, false);
            if (pass && pass.numPoints >= 3) {
              recursiveLeafFlow(state, nextFlow, sourceWinding, nextFlow.portal.winding, pvs);
            }
          } else {
            // Try clipping the target portal against the separating planes
            // constructed from the source portal and pass portal.
            let pass = clipToAntiPenumbra(sourceWinding, passWinding, nextFlow.portal.winding, false);
            if (pass && pass.numPoints >= 3) {
              pass = clipToAntiPenumbra(passWinding, sourceWinding, pass, true);
              if (pass && pass.numPoints >= 3) {
                recursiveLeafFlow(state, nextFlow, sourceWinding, pass, pvs);
              }
            }
          }
      }
    }
  }
}

/**
 * Compute full Potentially Visible Set for a cluster
 *
 * In a real VIS compiler, this traces rays and frustums through portals.
 * Because anti-penumbra clipping is extremely complex, this MVP recursively flows
 * through portals guided by `mightSee`.
 */
export function computeClusterPvs(
  state: VisibilityState,
  cluster: number
): BitSet {
  const pvs = new BitSet(state.numClusters);
  pvs.set(cluster);

  const flows = state.clusterPortals.get(cluster) || [];
  for (const flow of flows) {
    // Start the flow with the portal's own winding
    recursiveLeafFlow(state, flow, flow.portal.winding, flow.portal.winding, pvs);
  }

  return pvs;
}

/**
 * Clip a winding against anti-penumbra planes defined by the source and pass portals.
 * This effectively tightens the visibility frustum.
 *
 * @param pass The current tight view frustum winding at the previous portal.
 * @param source The original source portal winding.
 * @param target The target portal winding we want to clip against.
 * @returns The clipped winding, or null if completely clipped away.
 */
export function clipToAntiPenumbra(
  source: Winding,
  pass: Winding,
  target: Winding,
  flipclip: boolean
): Winding | null {
  let clippedTarget = copyWinding(target);

  const v1 = { x: 0, y: 0, z: 0 };
  const v2 = { x: 0, y: 0, z: 0 };
  const normal = { x: 0, y: 0, z: 0 };

  // Check all combinations
  for (let i = 0; i < source.numPoints; i++) {
    const l = (i + 1) % source.numPoints;
    v1.x = source.points[l].x - source.points[i].x;
    v1.y = source.points[l].y - source.points[i].y;
    v1.z = source.points[l].z - source.points[i].z;

    // find a vertex of pass that makes a plane that puts all of the
    // vertexes of pass on the front side and all of the vertexes of
    // source on the back side
    for (let j = 0; j < pass.numPoints; j++) {
      v2.x = pass.points[j].x - source.points[i].x;
      v2.y = pass.points[j].y - source.points[i].y;
      v2.z = pass.points[j].z - source.points[i].z;

      normal.x = v1.y * v2.z - v1.z * v2.y;
      normal.y = v1.z * v2.x - v1.x * v2.z;
      normal.z = v1.x * v2.y - v1.y * v2.x;

      let lengthSq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
      if (lengthSq < 1e-4) {
        continue; // collinear points or very short edges
      }

      const length = Math.sqrt(lengthSq);
      normal.x /= length;
      normal.y /= length;
      normal.z /= length;

      let dist = dotVec3(pass.points[j], normal);

      let fliptest = false;
      let k = 0;
      for (k = 0; k < source.numPoints; k++) {
        if (k === i || k === l) continue;
        const d = dotVec3(source.points[k], normal) - dist;
        if (d < -ON_EPSILON) {
          fliptest = false;
          break;
        } else if (d > ON_EPSILON) {
          fliptest = true;
          break;
        }
      }
      if (k === source.numPoints) continue; // planar with source portal

      if (fliptest) {
        normal.x = -normal.x;
        normal.y = -normal.y;
        normal.z = -normal.z;
        dist = -dist;
      }

      let counts = [0, 0, 0];
      for (k = 0; k < pass.numPoints; k++) {
        if (k === j) continue;
        const d = dotVec3(pass.points[k], normal) - dist;
        if (d < -ON_EPSILON) break;
        else if (d > ON_EPSILON) counts[0]++;
        else counts[2]++;
      }
      if (k !== pass.numPoints) continue; // points on negative side, not a separating plane
      if (!counts[0]) continue; // planar with separating plane

      if (flipclip) {
        normal.x = -normal.x;
        normal.y = -normal.y;
        normal.z = -normal.z;
        dist = -dist;
      }

      // chop winding
      // Note: we can't reuse `normal` if splitWinding captures a reference to it.
      // But splitWinding creates a copy of points using dot products. It reads the normal.
      const split = splitWinding(clippedTarget, { x: normal.x, y: normal.y, z: normal.z }, dist);
      if (!split.front) return null; // fully clipped
      clippedTarget = split.front;
    }
  }

  return clippedTarget;
}

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
 * Compute Potentially Hearable Set
 * PHS is typically PVS expanded by one portal step.
 * It determines which clusters can be heard from a given cluster.
 *
 * @param pvs Array of PVS BitSets for each cluster.
 * @param numClusters Total number of clusters.
 * @returns Array of PHS BitSets for each cluster.
 */
export function computePhs(
  pvs: BitSet[],
  numClusters: number
): BitSet[] {
  const phs: BitSet[] = [];
  const rowBytes = Math.ceil(numClusters / 8);

  for (let i = 0; i < numClusters; i++) {
    const pvsRow = pvs[i];
    const phsRow = new BitSet(numClusters);

    if (pvsRow) {
      // For every cluster 'j' that cluster 'i' can see (PVS)
      for (let j = 0; j < numClusters; j++) {
        if (pvsRow.get(j)) {
          // Add everything that 'j' can see to 'i's PHS using fast byte-wise OR.
          // Note: pvs[j] implicitly has the j-th bit set, so we don't need to manually set it.
          const jPvs = pvs[j];
          if (jPvs) {
            for (let b = 0; b < rowBytes; b++) {
              phsRow.data[b] |= jPvs.data[b];
            }
          }
        }
      }
    }

    phs.push(phsRow);
  }

  return phs;
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

/**
 * Compress visibility bitsets using Quake 2 run-length encoding.
 *
 * Format:
 * - 0x00: Next byte is count of zeroes
 * - Other: Literal byte (8 bits of visibility)
 *
 * Reference: q2tools/src/bspfile.c (CompressVis)
 */
export function compressPvs(
  uncompressed: Uint8Array
): Uint8Array {
  const result: number[] = [];
  const size = uncompressed.length;

  for (let i = 0; i < size; ) {
    if (uncompressed[i] === 0) {
      let rep = 1;
      for (let j = i + 1; j < size; j++) {
        if (uncompressed[j] === 0 && rep < 255) {
          rep++;
        } else {
          break;
        }
      }
      result.push(0, rep);
      i += rep;
    } else {
      result.push(uncompressed[i]);
      i++;
    }
  }

  return new Uint8Array(result);
}

/**
 * Decompress a single cluster's PVS.
 *
 * Reference: q2tools/src/bspfile.c (DecompressVis)
 */
export function decompressPvs(
  data: Uint8Array,
  offset: number,
  numClusters: number
): BitSet {
  const rowBytes = Math.ceil(numClusters / 8);
  const result = new BitSet(numClusters);
  let srcIndex = offset;
  let destIndex = 0;

  while (destIndex < rowBytes && srcIndex < data.length) {
    const value = data[srcIndex++];

    if (value !== 0) {
      result.data[destIndex++] = value;
      continue;
    }

    // value is 0, so next byte is run length
    if (srcIndex >= data.length) {
      break; // truncated
    }

    const runLength = data[srcIndex++];
    for (let i = 0; i < runLength && destIndex < rowBytes; i++) {
      result.data[destIndex++] = 0;
    }
  }

  return result;
}

export interface VisibilityData {
  numClusters: number;
  bitOffsets: number[];  // [pvs_offset, phs_offset] per cluster
  data: Uint8Array;
}

/**
 * Creates visibility lump data from raw PVS and PHS bitsets.
 * Compresses data and builds cluster offsets.
 *
 * Reference: q2tools/src/writebsp.c
 */
export interface VisOptions {
  /** Fast mode: flood fill only, no anti-penumbra */
  fast?: boolean;

  /** Number of threads (for future parallelization) */
  threads?: number;

  /** Progress callback */
  onProgress?: (percent: number) => void;
}

/**
 * Main visibility computation entry point.
 * Computes PVS, PHS, and builds the visibility lump data.
 *
 * @param portals Geometric portals between leaves.
 * @param numClusters Total number of visibility clusters.
 * @param options Visibility options (e.g. fast mode).
 * @returns The structured visibility lump data, or trivial vis if skipping/0 clusters.
 */
export function computeVisibility(
  portals: Portal[],
  numClusters: number,
  options?: VisOptions
): BspVisibility {
  if (numClusters <= 0) {
    return generateTrivialVis(numClusters);
  }

  const isFast = options?.fast ?? false;

  const state = initializePortalFlow(portals, numClusters);
  const pvsBits: BitSet[] = [];

  // If doing full VIS, we need to pre-compute the base topological visibility (mightSee)
  // for every portal so that the recursive frustum culling knows which portals to even test.
  if (!isFast) {
    for (const flow of state.portals) {
      flow.mightSee = floodFillVisibility(state, flow.backCluster);
    }
  }

  for (let i = 0; i < numClusters; i++) {
    if (isFast) {
      // Fast mode: just use flood fill (mightSee)
      pvsBits.push(floodFillVisibility(state, i));
    } else {
      // Full mode: recursively trace through portals
      pvsBits.push(computeClusterPvs(state, i));
    }

    if (options?.onProgress) {
      options.onProgress((i + 1) / numClusters * 100);
    }
  }

  const phsBits = computePhs(pvsBits, numClusters);

  return createVisibilityLump(pvsBits, phsBits, numClusters);
}

export function createVisibilityLump(
  pvs: BitSet[],
  phs: BitSet[],
  numClusters: number
): BspVisibility {
  if (numClusters <= 0) {
    return { numClusters: 0, clusters: [] };
  }

  const clusters: BspVisibilityCluster[] = [];

  for (let i = 0; i < numClusters; i++) {
    // Compress PVS
    const uncompressedPvs = pvs[i] ? pvs[i].data : new Uint8Array(Math.ceil(numClusters / 8));
    const compressedPvs = compressPvs(uncompressedPvs);

    // Compress PHS
    const uncompressedPhs = phs[i] ? phs[i].data : new Uint8Array(Math.ceil(numClusters / 8));
    const compressedPhs = compressPvs(uncompressedPhs);

    clusters.push({
      pvs: compressedPvs,
      phs: compressedPhs
    });
  }

  return {
    numClusters,
    clusters
  };
}
