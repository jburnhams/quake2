import { BspMap, Vec3, BspFace, BspTexInfo } from '../../assets/bsp.js';
import { BspSurfaceInput, BspSurfaceLightmap } from './geometry.js';
import { createFaceLightmap } from '../../assets/bsp.js';
import { SURF_WARP } from '@quake2ts/shared';

// Helper to calculate dot product
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Helper to check bounds and split
function getBounds(vertices: Vec3[]): { mins: Vec3, maxs: Vec3 } {
  const mins: Vec3 = [Infinity, Infinity, Infinity];
  const maxs: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const v of vertices) {
    for (let i = 0; i < 3; i++) {
      if (v[i] < mins[i]) mins[i] = v[i];
      if (v[i] > maxs[i]) maxs[i] = v[i];
    }
  }
  return { mins, maxs };
}

// Subdivide polygon recursively (approx. 64 units max size)
// Matches GL_SubdivideSurface / SubdividePolygon from gl_warp.c
function subdividePolygon(vertices: Vec3[]): Vec3[][] {
  const SUBDIVIDE_SIZE = 64;
  const { mins, maxs } = getBounds(vertices);

  for (let i = 0; i < 3; i++) {
    const min = mins[i];
    const max = maxs[i];
    let m = (min + max) * 0.5;
    m = SUBDIVIDE_SIZE * Math.floor(m / SUBDIVIDE_SIZE + 0.5);

    if (max - m < 8) continue;
    if (m - min < 8) continue;

    // Cut it
    const front: Vec3[] = [];
    const back: Vec3[] = [];
    const dists: number[] = [];

    for (const v of vertices) {
      dists.push(v[i] - m);
    }

    for (let j = 0; j < vertices.length; j++) {
      const v1 = vertices[j];
      const d1 = dists[j];
      const nextIdx = (j + 1) % vertices.length;
      const v2 = vertices[nextIdx];
      const d2 = dists[nextIdx];

      if (d1 >= 0) front.push(v1);
      if (d1 <= 0) back.push(v1);

      if (d1 > 0 && d2 < 0 || d1 < 0 && d2 > 0) {
        // Crossing the plane, split
        const frac = d1 / (d1 - d2);
        const split: Vec3 = [
          v1[0] + frac * (v2[0] - v1[0]),
          v1[1] + frac * (v2[1] - v1[1]),
          v1[2] + frac * (v2[2] - v1[2])
        ];
        front.push(split);
        back.push(split);
      }
    }

    // Recurse
    return [...subdividePolygon(front), ...subdividePolygon(back)];
  }

  // If no split needed, check vertex count.
  // In gl_warp.c, it adds a center point to make a fan if it wasn't split but is a warp surface.

  // Compute centroid
  const centroid: Vec3 = [0, 0, 0];
  for (const v of vertices) {
    centroid[0] += v[0];
    centroid[1] += v[1];
    centroid[2] += v[2];
  }
  centroid[0] /= vertices.length;
  centroid[1] /= vertices.length;
  centroid[2] /= vertices.length;

  // Build fan: Center -> V0 -> V1 -> ... -> VLast -> V0
  const polys: Vec3[][] = [];
  for (let k = 0; k < vertices.length; k++) {
    const v1 = vertices[k];
    const v2 = vertices[(k + 1) % vertices.length];
    polys.push([centroid, v1, v2]);
  }

  return polys;
}


export function createBspSurfaces(bsp: BspMap): BspSurfaceInput[] {
  const surfaces: BspSurfaceInput[] = [];

  for (let faceIndex = 0; faceIndex < bsp.faces.length; faceIndex++) {
    const face = bsp.faces[faceIndex];
    const texInfo = bsp.texInfo[face.texInfo];

    // 1. Collect vertices for the face
    let vertices: Vec3[] = [];
    for (let i = 0; i < face.numEdges; i++) {
      const edgeIndex = bsp.surfEdges[face.firstEdge + i];
      let v1: Vec3;
      if (edgeIndex >= 0) {
        v1 = bsp.vertices[bsp.edges[edgeIndex].vertices[0]];
      } else {
        v1 = bsp.vertices[bsp.edges[-edgeIndex].vertices[1]];
      }
      vertices.push(v1);
    }

    // Check for WARP flag
    let polygons: Vec3[][] = [vertices];
    if (texInfo.flags & SURF_WARP) {
      polygons = subdividePolygon(vertices);
    }

    for (const polyVerts of polygons) {
        // 2. Compute Texture Coordinates
        const texCoords: [number, number][] = polyVerts.map(v => [
          dot(v, texInfo.s) + texInfo.sOffset,
          dot(v, texInfo.t) + texInfo.tOffset
        ]);

        // 3. Compute Lightmap Coordinates
        // Warp surfaces don't use lightmaps
        let minU = Infinity, minV = Infinity;
        let maxU = -Infinity, maxV = -Infinity;
        const isWarp = (texInfo.flags & SURF_WARP) !== 0;

        if (!isWarp && face.lightOffset !== -1) {
          for (const v of polyVerts) {
              const u = dot(v, texInfo.s) + texInfo.sOffset;
              const v_val = dot(v, texInfo.t) + texInfo.tOffset;

              if (u < minU) minU = u;
              if (u > maxU) maxU = u;
              if (v_val < minV) minV = v_val;
              if (v_val > maxV) maxV = v_val;
          }

          minU = Math.floor(minU / 16);
          minV = Math.floor(minV / 16);
          maxU = Math.ceil(maxU / 16);
          maxV = Math.ceil(maxV / 16);
        }

        const lightmapCoords: [number, number][] = polyVerts.map(v => {
          if (isWarp || face.lightOffset === -1) {
            return [0, 0];
          }
          const u = (dot(v, texInfo.s) + texInfo.sOffset) / 16.0 - minU;
          const v_val = (dot(v, texInfo.t) + texInfo.tOffset) / 16.0 - minV;
          return [u, v_val];
        });

        // 4. Extract Lightmap Data
        let lightmap: BspSurfaceLightmap | undefined;
        if (!isWarp && face.lightOffset !== -1) {
          const width = maxU - minU + 1;
          const height = maxV - minV + 1;
          const info = bsp.lightMapInfo[faceIndex];
          const data = createFaceLightmap(face, bsp.lightMaps, info);

          if (data) {
            let numStyles = 0;
            for (const style of face.styles) {
                if (style !== 255) numStyles++;
            }
            const requiredLength = width * height * 3 * numStyles;

            if (data.byteLength >= requiredLength) {
                lightmap = {
                  width,
                  height,
                  data: data.subarray(0, requiredLength)
                };
            } else if (data.byteLength >= width * height * 3) {
                 lightmap = {
                   width,
                   height,
                   data: data.subarray(0, width * height * 3)
                 };
            }
          }
        }

        // 5. Interleave Vertex Data
        const vertexData = new Float32Array(polyVerts.length * 7);
        for (let i = 0; i < polyVerts.length; i++) {
          const v = polyVerts[i];
          const t = texCoords[i];
          const l = lightmapCoords[i];

          vertexData[i * 7 + 0] = v[0];
          vertexData[i * 7 + 1] = v[1];
          vertexData[i * 7 + 2] = v[2];
          vertexData[i * 7 + 3] = t[0];
          vertexData[i * 7 + 4] = t[1];
          vertexData[i * 7 + 5] = l[0];
          vertexData[i * 7 + 6] = l[1];
        }

        surfaces.push({
          faceIndex,
          textureName: texInfo.texture,
          flags: texInfo.flags,
          vertices: vertexData,
          vertexCount: polyVerts.length,
          styles: face.styles,
          lightmap
        });
    }
  }

  return surfaces;
}
