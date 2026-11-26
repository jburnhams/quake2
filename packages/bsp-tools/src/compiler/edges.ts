import { type Vec3 } from '@quake2ts/shared';
import type { CompileFace } from '../types/compile.js';
import { type BspEdge } from '../types/bsp.js';

export interface EdgesResult {
  edges: BspEdge[];
  surfEdges: Int32Array;
  vertices: Vec3[];
}

/**
 * Builds the edge list for the BSP.
 * Deduplicates edges shared between faces.
 * Generates the vertex list as well.
 */
export function buildEdges(faces: CompileFace[]): EdgesResult {
  const edges: BspEdge[] = [];
  const surfEdgesList: number[] = [];
  const vertices: Vec3[] = [];
  const vertexMap = new Map<string, number[]>(); // Hash -> [indices]

  // Edge lookup: v1_v2 -> edgeIndex
  // Note: key should be order independent if we check both directions.
  // Or store sorted key.
  // Map key: "minIdx_maxIdx"
  // Value: edgeIndex
  const edgeMap = new Map<string, number>();

  function addVertex(v: Vec3): number {
    const x = Math.round(v.x * 100) / 100;
    const y = Math.round(v.y * 100) / 100;
    const z = Math.round(v.z * 100) / 100;
    const key = `${Math.floor(x)}_${Math.floor(y)}_${Math.floor(z)}`;

    // Check existing vertices in bucket
    const bucket = vertexMap.get(key);
    if (bucket) {
      for (const idx of bucket) {
        const ov = vertices[idx];
        if (Math.abs(ov.x - v.x) < 0.01 &&
            Math.abs(ov.y - v.y) < 0.01 &&
            Math.abs(ov.z - v.z) < 0.01) {
          return idx;
        }
      }
    }

    const index = vertices.length;
    vertices.push(v); // Store original precision

    if (!bucket) {
      vertexMap.set(key, [index]);
    } else {
      bucket.push(index);
    }

    return index;
  }

  function addEdge(v1: number, v2: number): number {
    const k1 = Math.min(v1, v2);
    const k2 = Math.max(v1, v2);
    const key = `${k1}_${k2}`;

    if (edgeMap.has(key)) {
      const idx = edgeMap.get(key)!;
      // If v1 == vertices[idx][0], then it's positive direction.
      // If v1 == vertices[idx][1], then it's negative direction.
      const e = edges[idx];
      if (e.vertices[0] === v1 && e.vertices[1] === v2) return idx;
      if (e.vertices[0] === v2 && e.vertices[1] === v1) return -idx; // Traverse reverse
      // Should not happen if key is unique
      return idx;
    }

    const idx = edges.length;
    edges.push({ vertices: [v1, v2] });
    edgeMap.set(key, idx);
    // Since we just added [v1, v2], positive index means v1->v2
    return idx;
  }

  for (const face of faces) {
    if (!face.winding) continue;

    const w = face.winding;

    // We store the START index of surfEdges for this face in the BspFace structure later.
    // For now, we are just generating the list.
    // The BspFace construction needs to know the offset.
    // We can assume 'faces' array order is preserved.
    // But we are not modifying 'faces' here to add 'firstEdge'.
    // The caller needs to do that.

    // Actually, `flattenTree` serializes faces. `buildEdges` should probably run on the serialized face list?
    // Yes.

    const startEdge = surfEdgesList.length;

    for (let i = 0; i < w.numPoints; i++) {
      const p1 = w.points[i];
      const p2 = w.points[(i + 1) % w.numPoints];

      const v1 = addVertex(p1);
      const v2 = addVertex(p2);

      const edgeIdx = addEdge(v1, v2);
      surfEdgesList.push(edgeIdx);
    }
  }

  return {
    edges,
    surfEdges: new Int32Array(surfEdgesList),
    vertices
  };
}
