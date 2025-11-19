import { type Vec3 } from '@quake2ts/shared';

export interface FrustumPlane {
  readonly normal: Vec3;
  readonly distance: number;
}

function normalizePlane(plane: FrustumPlane): FrustumPlane {
  const { normal, distance } = plane;
  const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
  if (length === 0) {
    return plane;
  }
  const inv = 1 / length;
  return {
    normal: { x: normal.x * inv, y: normal.y * inv, z: normal.z * inv },
    distance: distance * inv,
  };
}

export function extractFrustumPlanes(matrix: readonly number[]): readonly FrustumPlane[] {
  if (matrix.length !== 16) {
    throw new Error('View-projection matrix must contain 16 elements');
  }

  const m00 = matrix[0];
  const m01 = matrix[4];
  const m02 = matrix[8];
  const m03 = matrix[12];
  const m10 = matrix[1];
  const m11 = matrix[5];
  const m12 = matrix[9];
  const m13 = matrix[13];
  const m20 = matrix[2];
  const m21 = matrix[6];
  const m22 = matrix[10];
  const m23 = matrix[14];
  const m30 = matrix[3];
  const m31 = matrix[7];
  const m32 = matrix[11];
  const m33 = matrix[15];

  const planes: FrustumPlane[] = [
    // Left
    normalizePlane({ normal: { x: m30 + m00, y: m31 + m01, z: m32 + m02 }, distance: m33 + m03 }),
    // Right
    normalizePlane({ normal: { x: m30 - m00, y: m31 - m01, z: m32 - m02 }, distance: m33 - m03 }),
    // Bottom
    normalizePlane({ normal: { x: m30 + m10, y: m31 + m11, z: m32 + m12 }, distance: m33 + m13 }),
    // Top
    normalizePlane({ normal: { x: m30 - m10, y: m31 - m11, z: m32 - m12 }, distance: m33 - m13 }),
    // Near
    normalizePlane({ normal: { x: m30 + m20, y: m31 + m21, z: m32 + m22 }, distance: m33 + m23 }),
    // Far
    normalizePlane({ normal: { x: m30 - m20, y: m31 - m21, z: m32 - m22 }, distance: m33 - m23 }),
  ];

  return planes;
}

function planeDistance(plane: FrustumPlane, point: Vec3): number {
  return plane.normal.x * point.x + plane.normal.y * point.y + plane.normal.z * point.z + plane.distance;
}

export function boxIntersectsFrustum(mins: Vec3, maxs: Vec3, planes: readonly FrustumPlane[]): boolean {
  for (const plane of planes) {
    // Choose the corner most likely to be outside based on the plane normal.
    const x = plane.normal.x >= 0 ? maxs.x : mins.x;
    const y = plane.normal.y >= 0 ? maxs.y : mins.y;
    const z = plane.normal.z >= 0 ? maxs.z : mins.z;
    if (planeDistance(plane, { x, y, z }) < 0) {
      return false;
    }
  }
  return true;
}
