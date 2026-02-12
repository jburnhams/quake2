import {
  Vec3,
  dotVec3
} from '@quake2ts/shared';
import {
  BspFace,
  BspTexInfo,
  BspEdge,
  BspPlane
} from '../types/bsp.js';

export function generateFullbrightLighting(
  faces: BspFace[],
  vertices: readonly Vec3[],
  texInfos: readonly BspTexInfo[],
  surfEdges: Int32Array,
  edges: readonly BspEdge[],
  planes: readonly BspPlane[]
): Uint8Array {
  const blobs: Uint8Array[] = [];
  let currentOffset = 0;

  // We must modify faces to set lightOffset.
  // Since we can't easily modify the input array if it's readonly in signature (though passed as mutable at runtime),
  // we assume the caller passes a mutable array.
  // We'll iterate and modify.

  for (const face of faces) {
    const tex = texInfos[face.texInfo];

    // If texInfo has special flags (SURF_SKY, SURF_WARP etc), might not need lightmap.
    // For MVP, if it's normal, we generate one.
    // Let's assume all solid faces get a lightmap for now.

    // 1. Calculate extents
    let minS = Infinity;
    let minT = Infinity;
    let maxS = -Infinity;
    let maxT = -Infinity;

    const firstEdge = face.firstEdge;
    const numEdges = face.numEdges;

    for (let i = 0; i < numEdges; i++) {
      const edgeIndex = surfEdges[firstEdge + i];
      const absEdgeIndex = Math.abs(edgeIndex);
      const edge = edges[absEdgeIndex];

      // Determine vertex
      // If edgeIndex > 0, v0 -> v1. If < 0, v1 -> v0.
      // But for extent calculation, order doesn't matter, just points.
      const v0 = vertices[edge.vertices[0]];
      const v1 = vertices[edge.vertices[1]];

      // Project v0
      const s0 = dotVec3(v0, tex.s) + tex.sOffset;
      const t0 = dotVec3(v0, tex.t) + tex.tOffset;

      if (s0 < minS) minS = s0;
      if (s0 > maxS) maxS = s0;
      if (t0 < minT) minT = t0;
      if (t0 > maxT) maxT = t0;

      // Project v1
      const s1 = dotVec3(v1, tex.s) + tex.sOffset;
      const t1 = dotVec3(v1, tex.t) + tex.tOffset;

      if (s1 < minS) minS = s1;
      if (s1 > maxS) maxS = s1;
      if (t1 < minT) minT = t1;
      if (t1 > maxT) maxT = t1;
    }

    // 2. Calculate lightmap dimensions
    // Q2 lightmaps are 1/16 scale
    const split = 16;
    const sMin = Math.floor(minS / split);
    const sMax = Math.ceil(maxS / split);
    const tMin = Math.floor(minT / split);
    const tMax = Math.ceil(maxT / split);

    const w = sMax - sMin + 1;
    const h = tMax - tMin + 1;

    // Sanity check
    if (w <= 0 || h <= 0) {
      // Degenerate face or texture
      (face as any).lightOffset = -1;
      continue;
    }

    // 3. Generate white lightmap
    const size = w * h * 3; // RGB
    const blob = new Uint8Array(size);
    blob.fill(255); // White

    // 4. Update face and store
    (face as any).lightOffset = currentOffset;
    blobs.push(blob);
    currentOffset += size;
  }

  // Concatenate all blobs
  const result = new Uint8Array(currentOffset);
  let offset = 0;
  for (const blob of blobs) {
    result.set(blob, offset);
    offset += blob.byteLength;
  }

  return result;
}
