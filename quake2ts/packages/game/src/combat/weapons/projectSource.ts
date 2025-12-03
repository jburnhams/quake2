import type { Vec3 } from '@quake2ts/shared';
import { addVec3, scaleVec3, copyVec3, subtractVec3, normalizeVec3, lengthVec3, MASK_SOLID, CONTENTS_DEADMONSTER, CONTENTS_MONSTER, CONTENTS_PLAYER, MASK_SHOT, MASK_PROJECTILE, angleVectors } from '@quake2ts/shared';
import type { Entity } from '../../entities/entity.js';
import type { GameExports } from '../../index.js';
import { HAND_LEFT, HAND_CENTER } from '../../inventory/playerInventory.js';

// From g_local.h
export const VIEW_HEIGHT = 22;

export interface ProjectSourceResult {
  point: Vec3;
  dir: Vec3;
}

export function P_ProjectSource(game: GameExports, ent: Entity, offset: Vec3, forward: Vec3, right: Vec3, up: Vec3): ProjectSourceResult {
  const distance = { ...offset };

  // Handle Handedness
  if (ent.client) {
    if (ent.client.hand === HAND_LEFT) {
      distance.y *= -1;
    } else if (ent.client.hand === HAND_CENTER) {
      distance.y = 0;
    }
  }

  const origin = copyVec3(ent.origin);
  // Add view height
  const eye = { ...origin, z: origin.z + (ent.viewheight ?? VIEW_HEIGHT) };

  // Calculate muzzle point (G_ProjectSource2)
  const f = scaleVec3(forward, distance.x);
  const r = scaleVec3(right, distance.y);
  const u = scaleVec3(up, distance.z);
  let point = addVec3(addVec3(addVec3(eye, f), r), u);

  // Trace from eye to target (8192 units forward)
  const end = addVec3(eye, scaleVec3(forward, 8192));

  // Use MASK_SHOT for checking what we hit (monsters, walls, etc.)
  // Rerelease uses MASK_PROJECTILE & ~CONTENTS_DEADMONSTER, effectively MASK_SHOT | CONTENTS_PROJECTILECLIP
  const mask = MASK_PROJECTILE & ~CONTENTS_DEADMONSTER;

  const tr = game.trace(eye, null, null, end, ent, mask);
  // Using a broader mask for safety, mimicking Rerelease logic slightly adjusted for TS imports available.
  // Actually, let's fix imports in next step if needed, but for now:

  // Rerelease logic:
  // if (tr.startsolid || ((tr.contents & (CONTENTS_MONSTER | CONTENTS_PLAYER)) && (tr.fraction * 8192.f) < 128.f))
  //    result_dir = forward;
  // else ...

  let dir = forward;

  // We need to check tr.contents. In TS trace result, 'contents' might be on the entity or surface?
  // GameExports.trace returns TraceResult.
  // TraceResult has `contents`.

  const dist = tr.fraction * 8192;
  const isClose = dist < 128;
  const hitMonsterOrPlayer = (tr.contents & (CONTENTS_MONSTER | CONTENTS_PLAYER)) !== 0;

  if (tr.startsolid || (hitMonsterOrPlayer && isClose)) {
      dir = forward;
  } else {
      // Convergence
      const target = tr.endpos;
      const vec = subtractVec3(target, point);
      dir = normalizeVec3(vec);
  }

  // Wall check for the muzzle point itself (prevent shooting through walls)
  // Re-use logic from previous implementation:
  // Trace from eye to point
  const trMuzzle = game.trace(eye, null, null, point, ent, MASK_SOLID);
  if (trMuzzle.fraction < 1.0) {
      // Pull back by 1 unit in the forward direction
      point = subtractVec3(trMuzzle.endpos, forward);
  }

  return { point, dir };
}

// Helper wrapper that calculates angle vectors automatically
export function getProjectileOrigin(game: GameExports, ent: Entity, offset: Vec3 = { x: 8, y: 8, z: 8 }): Vec3 {
  const { forward, right, up } = angleVectors(ent.client?.v_angle || ent.angles);
  const result = P_ProjectSource(game, ent, offset, forward, right, up);
  return result.point;
}
