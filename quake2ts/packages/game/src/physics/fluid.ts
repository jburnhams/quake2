import {
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  MASK_WATER,
  MASK_CURRENT,
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_UP,
  CONTENTS_CURRENT_DOWN,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, EntityFlags } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import { EntitySystem } from '../entities/system.js';
import { MutableVec3 } from '../ai/movement.js';

export function checkWater(ent: Entity, system: EntitySystem, imports: GameImports): void {
  const origin = ent.origin;
  const mins = ent.mins;
  const maxs = ent.maxs;

  // Guard against undefined origin/mins/maxs
  if (!origin || !mins || !maxs) {
      return;
  }

  // Pick a point at the feet
  const point: Vec3 = {
    x: origin.x + (mins.x + maxs.x) * 0.5,
    y: origin.y + (mins.y + maxs.y) * 0.5,
    z: origin.z + mins.z + 1,
  };

  let cont = imports.pointcontents(point);

  if ((cont & MASK_WATER) === 0) {
    if (ent.waterlevel > 0) {
      playLeaveWaterSound(ent, system);
      ent.flags &= ~EntityFlags.Swim;
    }
    ent.waterlevel = 0;
    ent.watertype = 0;
    return;
  }

  ent.watertype = cont;
  ent.waterlevel = 1;

  // Check waist
  const viewheight = ent.viewheight || (maxs.z - mins.z) * 0.8; // Approximation if viewheight not set
  const waist = origin.z + (mins.z + maxs.z) * 0.5;

  // Actually Quake 2 uses origin + mins + (maxs-mins)*0.5 for center/waist?
  // p_client.c PM_CheckWater:
  // feet = origin.z + mins.z + 1
  // waist = origin.z + mins.z + (viewheight - mins.z) * 0.5
  // head = origin.z + viewheight

  // Let's stick to p_move logic for consistency if possible, but for generic entities:
  // G_Physics (g_phys.c) calls SV_CheckWater (sv_phys.c).
  // SV_CheckWater:
  // feet = absmin + 1
  // waist = absmin + (size[2] * 0.5)
  // head = absmin + size[2] - 1 (or something near top)

  // Let's use:
  const feetZ = origin.z + mins.z + 1;
  const waistZ = origin.z + mins.z + (maxs.z - mins.z) * 0.5;
  const headZ = origin.z + maxs.z - 1; // Just below top

  // We already checked feet (approx)

  const waistPoint: Vec3 = { ...point, z: waistZ };
  cont = imports.pointcontents(waistPoint);
  if (cont & MASK_WATER) {
    ent.waterlevel = 2;

    const headPoint: Vec3 = { ...point, z: headZ };
    cont = imports.pointcontents(headPoint);
    if (cont & MASK_WATER) {
      ent.waterlevel = 3;
    }
  }

  if ((ent.flags & EntityFlags.Swim) === 0) {
    playEnterWaterSound(ent, system);
    ent.flags |= EntityFlags.Swim;
  }
}

function playEnterWaterSound(ent: Entity, system: EntitySystem): void {
  if (ent.watertype & CONTENTS_LAVA) {
    system.sound(ent, 0, 'player/lava_in.wav', 1, 1, 0);
  } else if (ent.watertype & CONTENTS_SLIME) {
    system.sound(ent, 0, 'player/watr_in.wav', 1, 1, 0);
  } else if (ent.watertype & CONTENTS_WATER) {
    system.sound(ent, 0, 'player/watr_in.wav', 1, 1, 0);
  }
}

function playLeaveWaterSound(ent: Entity, system: EntitySystem): void {
  if (ent.watertype & CONTENTS_LAVA) {
    system.sound(ent, 0, 'player/lava_out.wav', 1, 1, 0);
  } else if (ent.watertype & CONTENTS_SLIME) {
    system.sound(ent, 0, 'player/watr_out.wav', 1, 1, 0);
  } else if (ent.watertype & CONTENTS_WATER) {
    system.sound(ent, 0, 'player/watr_out.wav', 1, 1, 0);
  }
}

/**
 * Applies current forces to an entity's velocity.
 * @see PM_AddCurrents in p_move.c (Quake 2)
 */
export function SV_AddCurrents(ent: Entity, currentSpeed: number = 400.0): void {
  if (!(ent.watertype & MASK_CURRENT)) {
    return;
  }

  // Calculate current vector
  const v = { x: 0, y: 0, z: 0 };

  if (ent.watertype & CONTENTS_CURRENT_0) v.x += 1;
  if (ent.watertype & CONTENTS_CURRENT_90) v.y += 1;
  if (ent.watertype & CONTENTS_CURRENT_180) v.x -= 1;
  if (ent.watertype & CONTENTS_CURRENT_270) v.y -= 1;
  if (ent.watertype & CONTENTS_CURRENT_UP) v.z += 1;
  if (ent.watertype & CONTENTS_CURRENT_DOWN) v.z -= 1;

  // Apply speed scaling based on water level
  // If only feet in water, half speed. If waist or above, full speed.
  // Note: Q2 p_move logic: if (pm->waterlevel == 1 && pm->groundentity) s /= 2;
  // We assume if groundentity is set we are on ground.
  let speed = currentSpeed;
  if (ent.waterlevel === 1 && ent.groundentity) {
    speed *= 0.5;
  }

  const velocity = ent.velocity as MutableVec3;
  velocity.x += v.x * speed;
  velocity.y += v.y * speed;
  velocity.z += v.z * speed;
}
