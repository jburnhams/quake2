import { BspMap, Vec3, BspFace, BspTexInfo } from '../../assets/bsp.js';
import { BspSurfaceInput, BspSurfaceLightmap } from './geometry.js';
import { createFaceLightmap } from '../../assets/bsp.js';

// Helper to calculate dot product
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function createBspSurfaces(bsp: BspMap): BspSurfaceInput[] {
  const surfaces: BspSurfaceInput[] = [];

  for (let faceIndex = 0; faceIndex < bsp.faces.length; faceIndex++) {
    const face = bsp.faces[faceIndex];
    const texInfo = bsp.texInfo[face.texInfo];

    // 1. Collect vertices for the face
    const vertices: Vec3[] = [];
    for (let i = 0; i < face.numEdges; i++) {
      const edgeIndex = bsp.surfEdges[face.firstEdge + i];
      let v1: Vec3;
      // If edgeIndex is positive, use vertices in forward order (0 -> 1)
      // If negative, use reverse order (1 -> 0)
      if (edgeIndex >= 0) {
        v1 = bsp.vertices[bsp.edges[edgeIndex].vertices[0]];
      } else {
        v1 = bsp.vertices[bsp.edges[-edgeIndex].vertices[1]];
      }
      vertices.push(v1);
    }

    // 2. Compute Texture Coordinates
    // u = v . s + s_offset
    // v = v . t + t_offset
    const texCoords: [number, number][] = vertices.map(v => [
      dot(v, texInfo.s) + texInfo.sOffset,
      dot(v, texInfo.t) + texInfo.tOffset
    ]);

    // 3. Compute Lightmap Coordinates
    // For now, we will compute them similar to texture coords but divided by 16 (Quake 2 standard)
    // Actual lightmap atlas packing happens later, here we just prepare the data.
    // In Quake 2, lightmap UVs are:
    // u = (v . s + s_offset) / 16
    // v = (v . t + t_offset) / 16
    // Then shifted by the face's lightmap mins.

    let minU = Infinity, minV = Infinity;
    let maxU = -Infinity, maxV = -Infinity;

    if (face.lightOffset !== -1) {
       for (const v of vertices) {
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

    const lightmapCoords: [number, number][] = vertices.map(v => {
      if (face.lightOffset === -1) {
        return [0, 0];
      }
      const u = (dot(v, texInfo.s) + texInfo.sOffset) / 16.0 - minU;
      const v_val = (dot(v, texInfo.t) + texInfo.tOffset) / 16.0 - minV;
      return [u, v_val];
    });

    // 4. Extract Lightmap Data
    let lightmap: BspSurfaceLightmap | undefined;
    if (face.lightOffset !== -1) {
      const width = maxU - minU + 1;
      const height = maxV - minV + 1;
      // Quake 2 lightmaps are 128x128 max usually, packed into raw RGB data.
      // 3 bytes per pixel (RGB).
      // createFaceLightmap helper extracts the raw bytes.
      const info = bsp.lightMapInfo[faceIndex];
      const data = createFaceLightmap(face, bsp.lightMaps, info);

      if (data) {
        // Validation: data length should be roughly w * h * 3 (or close, due to alignment?)
        // Q2 lightmaps might strictly be w * h * 3.

        let numStyles = 0;
        for (const style of face.styles) {
            if (style !== 255) numStyles++;
        }

        const requiredLength = width * height * 3 * numStyles;

        // Ensure we have enough data and slice it exactly
        if (data.byteLength >= requiredLength) {
            lightmap = {
              width,
              height,
              data: data.subarray(0, requiredLength)
            };
        } else {
             console.warn(`Insufficient lightmap data for face ${faceIndex}. Expected ${requiredLength}, got ${data.byteLength}`);
             // Fallback? Use what we have, or null?
             // If we have at least one map, maybe use it?
             // But geometry builder expects integrity.
             if (data.byteLength >= width * height * 3) {
                 lightmap = {
                   width,
                   height,
                   data: data.subarray(0, width * height * 3)
                 };
             }
        }
      }
    }

    // 5. Interleave Vertex Data
    // Format: x, y, z, u, v, lu, lv
    const vertexData = new Float32Array(vertices.length * 7);
    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const t = texCoords[i];
      const l = lightmapCoords[i];

      vertexData[i * 7 + 0] = v[0];
      vertexData[i * 7 + 1] = v[1];
      vertexData[i * 7 + 2] = v[2];
      vertexData[i * 7 + 3] = t[0];
      vertexData[i * 7 + 4] = t[1];
      vertexData[i * 7 + 5] = l[0]; // Lightmap coordinates will be adjusted by atlas packer later
      vertexData[i * 7 + 6] = l[1];
    }

    surfaces.push({
      faceIndex,
      textureName: texInfo.texture,
      flags: texInfo.flags,
      vertices: vertexData,
      vertexCount: vertices.length,
      styles: face.styles,
      lightmap
    });
  }

  return surfaces;
}
