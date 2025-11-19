import type { Vec3 } from '@quake2ts/shared';
import { angleVectors, ZERO_VEC3 } from '@quake2ts/shared';

const VEC_UP: Vec3 = { x: 0, y: -1, z: 0 } as const;
const MOVEDIR_UP: Vec3 = { x: 0, y: 0, z: 1 } as const;
const VEC_DOWN: Vec3 = { x: 0, y: -2, z: 0 } as const;
const MOVEDIR_DOWN: Vec3 = { x: 0, y: 0, z: -1 } as const;

function vecEquals(a: Vec3, b: Vec3): boolean {
  return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function isZeroVector(vector: Vec3): boolean {
  return vecEquals(vector, ZERO_VEC3 as Vec3);
}

export function setMovedir(angles: Vec3): Vec3 {
  if (vecEquals(angles, VEC_UP)) {
    return { ...MOVEDIR_UP };
  }
  if (vecEquals(angles, VEC_DOWN)) {
    return { ...MOVEDIR_DOWN };
  }
  return { ...angleVectors(angles).forward };
}
