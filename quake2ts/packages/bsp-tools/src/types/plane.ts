import { type Vec3 } from '@quake2ts/shared';

// Plane axis types (from q2tools/src/qfiles.h:126-133)
export const PLANE_X = 0;      // normal is +/- (1,0,0)
export const PLANE_Y = 1;      // normal is +/- (0,1,0)
export const PLANE_Z = 2;      // normal is +/- (0,0,1)
export const PLANE_ANYX = 3;   // normal predominantly X
export const PLANE_ANYY = 4;   // normal predominantly Y
export const PLANE_ANYZ = 5;   // normal predominantly Z

/**
 * Determines the plane type based on the normal vector.
 * Logic derived from q2tools/src/map.c PlaneTypeForNormal
 */
export function planeTypeForNormal(normal: Vec3): number {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  // Exact matches for axial planes
  if (ax === 1 && ay === 0 && az === 0) return PLANE_X;
  if (ax === 0 && ay === 1 && az === 0) return PLANE_Y;
  if (ax === 0 && ay === 0 && az === 1) return PLANE_Z;

  if (ax >= ay && ax >= az) {
    return PLANE_ANYX;
  }
  if (ay >= ax && ay >= az) {
    return PLANE_ANYY;
  }
  return PLANE_ANYZ;
}
