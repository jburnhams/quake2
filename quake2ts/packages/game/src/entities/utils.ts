import type { Vec3 } from '@quake2ts/shared';
import { angleVectors, ZERO_VEC3, normalizeVec3, scaleVec3, clipVelocityVec3 } from '@quake2ts/shared';
import { Entity, Solid } from './entity.js';
import { EntitySystem } from './system.js';

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

export function touchTriggers(ent: Entity, system: EntitySystem): void {
  if (!ent.client) {
    return;
  }

  system.forEachEntity((other) => {
    if (other === ent) return;
    if (other.solid !== Solid.Trigger) return;

    if (
      ent.absmin.x > other.absmax.x ||
      ent.absmax.x < other.absmin.x ||
      ent.absmin.y > other.absmax.y ||
      ent.absmax.y < other.absmin.y ||
      ent.absmin.z > other.absmax.z ||
      ent.absmax.z < other.absmin.z
    ) {
      return;
    }

    if (other.touch) {
      other.touch(other, ent);
    }
  });
}

export function velocityForDamage(damage: number, kick: number): Vec3 {
  // Simple random spread for now, real implementation might use randomness from system
  const x = (Math.random() - 0.5) * 2;
  const y = (Math.random() - 0.5) * 2;
  const z = (Math.random() - 0.5) * 2;

  const dir = normalizeVec3({ x, y, z });
  return scaleVec3(dir, damage * kick);
}

export function clipVelocity(inVel: Vec3, normal: Vec3, overbounce: number): Vec3 {
  return clipVelocityVec3(inVel, normal, overbounce);
}
