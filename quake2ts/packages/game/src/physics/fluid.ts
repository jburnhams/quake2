import {
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  MASK_WATER,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, EntityFlags } from '../entities/entity.js';
import { GameImports } from '../imports.js';
import { EntitySystem } from '../entities/system.js';

export function checkWater(ent: Entity, system: EntitySystem, imports: GameImports): void {
  const origin = ent.origin;
  const mins = ent.mins;
  const maxs = ent.maxs;

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
  // G_Physics (g_phys.c) calls SV_CheckWater (sv_phys.c).
  // SV_CheckWater:
  // feet = absmin + 1
  // waist = absmin + (size[2] * 0.5)
  // head = absmin + size[2] - 1 (or something near top)

  // Let's use:
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
