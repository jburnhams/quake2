import type { Vec3 } from '@quake2ts/shared';
import {
  addVec3,
  scaleVec3,
  copyVec3,
  subtractVec3,
  normalizeVec3,
  MASK_SOLID,
  MASK_PROJECTILE,
  CONTENTS_DEADMONSTER,
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  angleVectors,
} from '@quake2ts/shared';
import type { Entity } from '../../entities/entity.js';
import type { GameExports } from '../../index.js';

// From g_local.h
export const VIEW_HEIGHT = 22;

export function P_ProjectSource(game: GameExports, ent: Entity, offset: Vec3, forward: Vec3, right: Vec3, up: Vec3): Vec3 {
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
  const tr = game.trace(eye, null, null, point, ent, MASK_SOLID);

  if (tr.fraction < 1.0) {
      // Pull back by 1 unit in the forward direction to prevent shooting through walls
      return { x: tr.endpos.x - forward.x, y: tr.endpos.y - forward.y, z: tr.endpos.z - forward.z };
  }

  return point;
}

export type ProjectedShot = { start: Vec3; dir: Vec3; forward: Vec3; right: Vec3; up: Vec3 };

/**
 * The rerelease's P_ProjectSource (p_weapon.cpp): the shot starts at the gun (the eye plus
 * `offset` along the view) but flies at what the crosshair is on, a trace from the eye 8192
 * units along the view, so a gun held 8 units right and below still hits the centre of the
 * screen whichever way the player looks. Point blank at a monster or player (under 128 units),
 * or with the eye inside something solid, it flies straight along the view, as there.
 * `angles` is usually client.v_angle; the super shotgun turns it 5 degrees each way.
 */
export function P_ProjectShot(game: GameExports, ent: Entity, angles: Vec3, offset: Vec3): ProjectedShot {
  const { forward, right, up } = angleVectors(angles);
  const start = P_ProjectSource(game, ent, offset, forward, right, up);
  const eye = { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z + (ent.viewheight ?? VIEW_HEIGHT) };
  const tr = game.trace(eye, null, null, addVec3(eye, scaleVec3(forward, 8192)), ent, MASK_PROJECTILE & ~CONTENTS_DEADMONSTER);
  if (!tr || tr.startsolid || ((tr.contents & (CONTENTS_MONSTER | CONTENTS_PLAYER)) && tr.fraction * 8192 < 128)) {
    return { start, dir: forward, forward, right, up };
  }
  // tr.endpos, worked out from the fraction (the same point for a real trace) so the aim point is
  // always on the view line.
  const toAim = subtractVec3(addVec3(eye, scaleVec3(forward, 8192 * tr.fraction)), start);
  // The aim point is the gun's own spot (a wall against the muzzle): fly along the view.
  const dir = toAim.x === 0 && toAim.y === 0 && toAim.z === 0 ? forward : normalizeVec3(toAim);
  return { start, dir, forward, right, up };
}

// Helper wrapper that calculates angle vectors automatically
export function getProjectileOrigin(game: GameExports, ent: Entity, offset: Vec3 = { x: 8, y: 8, z: 8 }): Vec3 {
  const { forward, right, up } = angleVectors(ent.client?.v_angle || ent.angles);
  return P_ProjectSource(game, ent, offset, forward, right, up);
}

// Helper to get weapon firing vectors (legacy helper, might be useful)
export function getWeaponVectors(ent: Entity, angleVectorsFn: (angles: Vec3) => { forward: Vec3, right: Vec3, up: Vec3 }): { forward: Vec3, right: Vec3, up: Vec3, origin: Vec3 } {
  const { forward, right, up } = angleVectorsFn(ent.client?.v_angle || ent.angles);
  return { forward, right, up, origin: ent.origin };
}
