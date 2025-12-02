import type { Vec3 } from '@quake2ts/shared';
import { addVec3, scaleVec3, copyVec3, MASK_SOLID } from '@quake2ts/shared';
import type { Entity } from '../../entities/entity.js';
import type { TraceFunction } from '../../imports.js';

// From g_local.h
export const VIEW_HEIGHT = 22;

export function P_ProjectSource(ent: Entity, offset: Vec3, forward: Vec3, right: Vec3, up: Vec3, trace: TraceFunction): Vec3 {
  const origin = copyVec3(ent.origin);

  // Add view height
  const eye = { ...origin, z: origin.z + (ent.viewheight ?? VIEW_HEIGHT) };

  // Apply offsets
  // P_ProjectSource logic:
  // point = origin + forward * offset[0] + right * offset[1] + up * offset[2]

  const f = scaleVec3(forward, offset.x);
  const r = scaleVec3(right, offset.y);
  const u = scaleVec3(up, offset.z);

  const point = addVec3(addVec3(addVec3(eye, f), r), u);

  // Wall check: Trace from eye to point
  // If we hit something, pull back to the hit point to prevent shooting through walls
  // Rerelease p_weapon.cpp:126-135
  const tr = trace(eye, null, null, point, ent, MASK_SOLID);

  if (tr.fraction < 1.0) {
      return tr.endpos;
  }

  return point;
}

// Helper to get weapon firing vectors (legacy helper, might be useful)
export function getWeaponVectors(ent: Entity, angleVectors: (angles: Vec3) => { forward: Vec3, right: Vec3, up: Vec3 }): { forward: Vec3, right: Vec3, up: Vec3, origin: Vec3 } {
  const { forward, right, up } = angleVectors(ent.client?.v_angle || ent.angles);
  return { forward, right, up, origin: ent.origin };
}
