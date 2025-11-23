import { BspMap, BspLeaf, BspNode, BspPlane } from '../assets/bsp.js';
import { Vec3 } from '@quake2ts/shared';

// Standard Quake 2 light scale
const LIGHT_SCALE = 1.0;

export function findLeaf(map: BspMap, point: Vec3): { leaf: BspLeaf; index: number } {
  let nodeIndex = map.models[0].headNode;

  while (nodeIndex >= 0) {
    const node = map.nodes[nodeIndex];
    const plane = map.planes[node.planeIndex];

    // Distance from plane
    const dist = plane.normal[0] * point.x + plane.normal[1] * point.y + plane.normal[2] * point.z - plane.dist;

    if (dist >= 0) {
      nodeIndex = node.children[0];
    } else {
      nodeIndex = node.children[1];
    }
  }

  const index = -(nodeIndex + 1);
  return { leaf: map.leafs[index], index };
}

export function getMinLight(map: BspMap): number {
  if (map.entities.worldspawn?.properties['light']) {
     const val = parseInt(map.entities.worldspawn.properties['light'], 10);
     if (!isNaN(val)) return val / 255.0;
  }
  if (map.entities.worldspawn?.properties['_minlight']) {
     const val = parseInt(map.entities.worldspawn.properties['_minlight'], 10);
     if (!isNaN(val)) return val / 255.0;
  }
  return 0.2; // Default fall back
}

export function sampleLightmap(map: BspMap, faceIndex: number, u: number, v: number): number {
  const face = map.faces[faceIndex];
  if (!face || face.lightOffset < 0) {
    return 0;
  }

  // Find lightmap info
  const info = map.lightMapInfo[faceIndex];
  if (!info) return 0;

  // BspSurfacePipeline creates lightmaps, but we can access raw data if we load it.
  // However, `map.lightMaps` is a Uint8Array of all lightmaps.
  // We need the dimensions of this face's lightmap to sample it correctly.
  // This logic replicates `createFaceLightmap` in `bsp.ts` partially to find dims.

  const texInfo = map.texInfo[face.texInfo];
  let minS = Infinity, maxS = -Infinity, minT = Infinity, maxT = -Infinity;

  // Re-calculate extents (expensive, but necessary without caching)
  let edgeIndex = face.firstEdge;
  for (let i = 0; i < face.numEdges; i++) {
      const eIndex = map.surfEdges[edgeIndex + i];
      const vIndex = eIndex >= 0 ? map.edges[eIndex].vertices[0] : map.edges[Math.abs(eIndex)].vertices[1];
      const vert = map.vertices[vIndex];

      const s = vert[0] * texInfo.s[0] + vert[1] * texInfo.s[1] + vert[2] * texInfo.s[2] + texInfo.sOffset;
      const t = vert[0] * texInfo.t[0] + vert[1] * texInfo.t[1] + vert[2] * texInfo.t[2] + texInfo.tOffset;

      if (s < minS) minS = s;
      if (s > maxS) maxS = s;
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
  }

  const floorMinS = Math.floor(minS / 16);
  const floorMinT = Math.floor(minT / 16);
  const lmWidth = Math.ceil(maxS / 16) - floorMinS + 1;
  const lmHeight = Math.ceil(maxT / 16) - floorMinT + 1;

  // UV in lightmap space (0..width, 0..height)
  const ls = (u / 16) - floorMinS;
  const lt = (v / 16) - floorMinT;

  // Clamping
  const x = Math.max(0, Math.min(lmWidth - 1, Math.floor(ls)));
  const y = Math.max(0, Math.min(lmHeight - 1, Math.floor(lt)));

  const offset = face.lightOffset + (y * lmWidth + x) * 3;

  if (offset + 2 >= map.lightMaps.length) return 0;

  const r = map.lightMaps[offset];
  const g = map.lightMaps[offset + 1];
  const b = map.lightMaps[offset + 2];

  // Return max component normalized
  return Math.max(r, g, b) / 255.0;
}

export function calculateEntityLight(map: BspMap | undefined, origin: Vec3): number {
    if (!map) return 1.0; // Full bright if no map

    // Start with global minimum light level
    const minLight = getMinLight(map);

    // Trace down 8192 units
    const end = { x: origin.x, y: origin.y, z: origin.z - 8192 };

    // Simplified Ray Trace against BSP nodes
    // We need to find the first surface hit by the ray (origin -> end)
    let bestFraction = 1.0;
    let bestFaceIndex = -1;
    let bestU = 0;
    let bestV = 0;

    // Check leaf faces directly below the point?
    // No, BSP faces are stored in leaves but we need to traverse nodes to raycast efficiently.
    // Since we don't have a full collision library here, let's try a simplified approach:
    // Find the leaf the point is in.
    const { leaf, index: leafIndex } = findLeaf(map, origin);

    // If we are in a solid, move up slightly? Or just accept minLight.
    if (leaf.contents & 1) { // CONTENTS_SOLID
        return minLight;
    }

    // Check faces in current leaf for a floor directly below
    const leafFaces = map.leafLists.leafFaces[leafIndex];

    if (leafFaces) {
        for (const faceIndex of leafFaces) {
            const face = map.faces[faceIndex];
            const plane = map.planes[face.planeIndex];
            const side = face.side;

            // Adjust normal based on side
            const nx = side ? -plane.normal[0] : plane.normal[0];
            const ny = side ? -plane.normal[1] : plane.normal[1];
            const nz = side ? -plane.normal[2] : plane.normal[2];
            const dist = side ? -plane.dist : plane.dist;

            // Is it a floor? (Normal pointing up)
            if (nz > 0.7) {
                // Distance check: point must be above plane
                const d = nx * origin.x + ny * origin.y + nz * origin.z - dist;

                // If we are close above it (e.g., within 64 units)
                if (d >= 0 && d < 64) {
                    // Project point onto plane to get UVs
                    const texInfo = map.texInfo[face.texInfo];
                    const s = origin.x * texInfo.s[0] + origin.y * texInfo.s[1] + origin.z * texInfo.s[2] + texInfo.sOffset;
                    const t = origin.x * texInfo.t[0] + origin.y * texInfo.t[1] + origin.z * texInfo.t[2] + texInfo.tOffset;

                    const light = sampleLightmap(map, faceIndex, s, t);
                    if (light > minLight) {
                        return light;
                    }
                }
            }
        }
    }

    return Math.max(minLight, 0.2);
}
