import { type Vec3, type Mat4 } from '@quake2ts/shared';

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

export function extractFrustumPlanes(matrix: ArrayLike<number>): readonly FrustumPlane[] {
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

export function transformAabb(mins: Vec3, maxs: Vec3, transform: Mat4): { mins: Vec3; maxs: Vec3 } {
  // Center and extents
  const cx = (mins.x + maxs.x) * 0.5;
  const cy = (mins.y + maxs.y) * 0.5;
  const cz = (mins.z + maxs.z) * 0.5;
  const ex = (maxs.x - mins.x) * 0.5;
  const ey = (maxs.y - mins.y) * 0.5;
  const ez = (maxs.z - mins.z) * 0.5;

  // Transform center
  const m = transform;
  const tcx = m[0] * cx + m[4] * cy + m[8] * cz + m[12];
  const tcy = m[1] * cx + m[5] * cy + m[9] * cz + m[13];
  const tcz = m[2] * cx + m[6] * cy + m[10] * cz + m[14];

  // Transform extents (absolute sum)
  const tex =
    Math.abs(m[0]) * ex + Math.abs(m[4]) * ey + Math.abs(m[8]) * ez;
  const tey =
    Math.abs(m[1]) * ex + Math.abs(m[5]) * ey + Math.abs(m[9]) * ez;
  const tez =
    Math.abs(m[2]) * ex + Math.abs(m[6]) * ey + Math.abs(m[10]) * ez;

  return {
    mins: { x: tcx - tex, y: tcy - tey, z: tcz - tez },
    maxs: { x: tcx + tex, y: tcy + tey, z: tcz + tez },
  };
}
