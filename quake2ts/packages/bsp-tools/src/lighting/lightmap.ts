import { Vec3, dotVec3, crossVec3, scaleVec3, addVec3, subtractVec3 } from '@quake2ts/shared';
import type { CompileFace, CompilePlane } from '../types/compile.js';
import type { BspTexInfo } from '../types/bsp.js';

export interface LightmapInfo {
  width: number;
  height: number;
  mins: [number, number];  // UV mins
  maxs: [number, number];  // UV maxs
  luxelSize: number;  // World units per lightmap pixel
}

/**
 * Calculate lightmap dimensions for a face
 */
export function calculateLightmapSize(
  face: CompileFace,
  texInfo: BspTexInfo,
  luxelSize: number = 16
): LightmapInfo {
  let minS = Infinity;
  let maxS = -Infinity;
  let minT = Infinity;
  let maxT = -Infinity;

  const points = face.winding.points; // Access Winding points array

  for (let i = 0; i < face.winding.numPoints; i++) {
    const v = points[i];
    const s = dotVec3(v, texInfo.s) + texInfo.sOffset;
    const t = dotVec3(v, texInfo.t) + texInfo.tOffset;
    if (s < minS) minS = s;
    if (s > maxS) maxS = s;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }

  // Handle faces with no vertices (shouldn't happen, but just in case)
  if (minS === Infinity) {
    minS = maxS = minT = maxT = 0;
  }

  const bminS = Math.floor(minS / luxelSize);
  const bminT = Math.floor(minT / luxelSize);
  const bmaxS = Math.ceil(maxS / luxelSize);
  const bmaxT = Math.ceil(maxT / luxelSize);

  const width = (bmaxS - bminS) + 1;
  const height = (bmaxT - bminT) + 1;

  return {
    width,
    height,
    mins: [bminS, bminT],
    maxs: [bmaxS, bmaxT],
    luxelSize
  };
}

/**
 * Generate world-space sample points for lightmap pixels
 */
export function generateSamplePoints(
  face: CompileFace,
  lightmapInfo: LightmapInfo,
  texInfo: BspTexInfo,
  planes: CompilePlane[]
): Vec3[] {
  const plane = planes[face.planeNum];
  const n = plane.normal;
  const d = plane.dist;

  // Need to find 3 vectors to form a basis
  // v1 = s
  // v2 = t
  // v3 = n
  const vs = texInfo.s;
  const vt = texInfo.t;

  // Calculate inverse matrix to project from (S,T,D) to (X,Y,Z)
  // X = x0 + s * dx/ds + t * dx/dt
  // M = [s, t, n]^T
  // det(M) = n . (s x t)
  const nX = n.x, nY = n.y, nZ = n.z;
  const sX = vs.x, sY = vs.y, sZ = vs.z;
  const tX = vt.x, tY = vt.y, tZ = vt.z;

  // Cramer's rule / matrix inversion for:
  // [ sX sY sZ ] [ x ]   [ S - Os ]
  // [ tX tY tZ ] [ y ] = [ T - Ot ]
  // [ nX nY nZ ] [ z ]   [ D      ]

  // adjugate matrix columns (which are rows of inverse)
  const c0x = tY * nZ - tZ * nY;
  const c0y = tZ * nX - tX * nZ;
  const c0z = tX * nY - tY * nX;

  const c1x = nY * sZ - nZ * sY;
  const c1y = nZ * sX - nX * sZ;
  const c1z = nX * sY - nY * sX;

  const c2x = sY * tZ - sZ * tY;
  const c2y = sZ * tX - sX * tZ;
  const c2z = sX * tY - sY * tX;

  const det = sX * c0x + sY * c0y + sZ * c0z;

  if (Math.abs(det) < 0.00001) {
    const points = face.winding.points;
    let center = { x: 0, y: 0, z: 0 } as Vec3;
    for (let i = 0; i < face.winding.numPoints; i++) {
      center = addVec3(center, points[i]);
    }
    const nVerts = Math.max(1, face.winding.numPoints);
    const avg = scaleVec3(center, 1 / nVerts);
    return new Array(lightmapInfo.width * lightmapInfo.height).fill(avg);
  }

  const invDet = 1.0 / det;

  const m00 = c0x * invDet, m01 = c1x * invDet, m02 = c2x * invDet;
  const m10 = c0y * invDet, m11 = c1y * invDet, m12 = c2y * invDet;
  const m20 = c0z * invDet, m21 = c1z * invDet, m22 = c2z * invDet;

  const points: Vec3[] = [];

  const luxelSize = lightmapInfo.luxelSize;
  const startS = lightmapInfo.mins[0] * luxelSize;
  const startT = lightmapInfo.mins[1] * luxelSize;

  for (let t = 0; t < lightmapInfo.height; t++) {
    for (let s = 0; s < lightmapInfo.width; s++) {
      const sampleS = startS + (s + 0.5) * luxelSize - texInfo.sOffset;
      const sampleT = startT + (t + 0.5) * luxelSize - texInfo.tOffset;

      const px = m00 * sampleS + m01 * sampleT + m02 * d;
      const py = m10 * sampleS + m11 * sampleT + m12 * d;
      const pz = m20 * sampleS + m21 * sampleT + m22 * d;

      points.push({ x: px, y: py, z: pz } as Vec3);
    }
  }

  return points;
}
