import { BspVisibility, BspVisibilityCluster } from '../types/bsp.js';

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
