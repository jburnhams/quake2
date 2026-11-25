/**
 * MOVETYPE_TOSS, BOUNCE, FLY, FLYMISSILE and WALLBOUNCE: SV_PushEntity, G_Impact and
 * SV_Physics_Toss from the rerelease g_phys.cpp. Projectiles fly until they hit something,
 * run their touch (and what they hit runs its own), and set off triggers on the way; gibs and
 * grenades fall, bounce and come to rest.
 */
import {
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  MASK_WATER,
  clipVelocityVec3,
  slideClipVelocityVec3,
  vectorToAngles,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, MoveType, ServerFlags, Solid } from '../entities/entity.js';
import { EntityFlags } from '../entities/enums.js';
import type { EntitySystem } from '../entities/system.js';
import type { GameTraceResult } from '../imports.js';
import { M_CatagorizePosition, M_WorldEffects } from '../ai/monsterStart.js';
import { addGravity, checkVelocity } from './step.js';
import { getClipMask } from './pusher.js';

const WATER_NONE = 0;
const WATER_FEET = 1;

/** G_Impact: both entities' touch functions, the mover's first. */
export function G_Impact(e1: Entity, trace: GameTraceResult, sys: EntitySystem): void {
  const e2 = (trace.ent as Entity | null) ?? sys.world;
  const surf = trace.surfaceFlags ? { name: '', flags: trace.surfaceFlags, value: 0 } : null;
  if (e1.touch && (e1.solid !== Solid.Not || e1.flags & EntityFlags.AlwaysTouch)) e1.touch(e1, e2, trace.plane, surf);
  if (e2.touch && (e2.solid !== Solid.Not || e2.flags & EntityFlags.AlwaysTouch)) e2.touch(e2, e1, trace.plane, surf);
}

/** SV_PushEntity: move the entity by push, clipped, touching what it hits and the triggers it ends in. */
export function SV_PushEntity(ent: Entity, push: Vec3, sys: EntitySystem): GameTraceResult {
  for (;;) {
    const start = { ...ent.origin };
    const end = { x: start.x + push.x, y: start.y + push.y, z: start.z + push.z };
    const trace = sys.trace(start, ent.mins, ent.maxs, end, ent, getClipMask(ent));
    const n = trace.plane?.normal ?? { x: 0, y: 0, z: 0 };
    ent.origin = { x: trace.endpos.x + n.x * 0.5, y: trace.endpos.y + n.y * 0.5, z: trace.endpos.z + n.z * 0.5 };
    sys.linkentity(ent);

    if (trace.fraction !== 1 || trace.startsolid) {
      G_Impact(ent, trace, sys);
      // If the pushed entity went away and the pusher is still there, move back and try again.
      const hit = trace.ent as Entity | null;
      if (hit && !hit.inUse && ent.inUse) {
        ent.origin = start;
        sys.linkentity(ent);
        continue;
      }
    }

    ent.gravity = 1;
    if (ent.inUse) sys.touchTriggers(ent);
    return trace;
  }
}

/** SV_Physics_Toss, after its SV_RunThink (the entity system runs the think). */
export function SV_Physics_Toss(ent: Entity, sys: EntitySystem, levelGravity: number): void {
  // A team slave is moved by its captain.
  if (ent.flags & EntityFlags.TeamSlave) return;

  if (ent.velocity.z > 0) ent.groundentity = null;
  if (ent.groundentity && !ent.groundentity.inUse) ent.groundentity = null;

  // On the ground: don't move.
  if (ent.groundentity && ent.gravity > 0) {
    if (ent.svflags & ServerFlags.Monster) {
      M_CatagorizePosition(ent, ent.origin, sys);
      M_WorldEffects(ent, sys);
    }
    return;
  }

  const oldOrigin = { ...ent.origin };
  checkVelocity(ent);

  const frametime = sys.frameTimeSeconds;
  if (ent.movetype !== MoveType.Fly && ent.movetype !== MoveType.FlyMissile && ent.movetype !== MoveType.WallBounce) {
    addGravity(ent, levelGravity, frametime);
  }

  ent.angles = {
    x: ent.angles.x + ent.avelocity.x * frametime,
    y: ent.angles.y + ent.avelocity.y * frametime,
    z: ent.angles.z + ent.avelocity.z * frametime,
  };

  let tries = 5;
  let timeLeft = frametime;
  while (timeLeft) {
    if (tries === 0) break;
    tries--;
    const move = { x: ent.velocity.x * timeLeft, y: ent.velocity.y * timeLeft, z: ent.velocity.z * timeLeft };
    const trace = SV_PushEntity(ent, move, sys);
    if (!ent.inUse) return;
    if (trace.fraction === 1) break;
    const hit = (trace.ent as Entity | null) ?? sys.world;
    // [Paril-KEX] don't build up velocity if stuck: take what was hit as the ground.
    if (trace.allsolid) {
      ent.groundentity = hit;
      ent.groundentity_linkcount = hit.linkcount;
      ent.velocity = { x: 0, y: 0, z: 0 };
      ent.avelocity = { x: 0, y: 0, z: 0 };
      break;
    }

    timeLeft -= timeLeft * trace.fraction;
    const normal = trace.plane?.normal ?? { x: 0, y: 0, z: 0 };

    if (ent.movetype === MoveType.Toss) ent.velocity = slideClipVelocityVec3(ent.velocity, normal, 0.5);
    else ent.velocity = clipVelocityVec3(ent.velocity, normal, ent.movetype === MoveType.WallBounce ? 2 : 1.6);

    if (ent.movetype === MoveType.WallBounce) {
      ent.angles = vectorToAngles(ent.velocity);
    } else if (normal.z > 0.7) {
      // Stop if on ground.
      const v = ent.velocity;
      const along = ent.movetype === MoveType.Toss
        ? Math.hypot(v.x, v.y, v.z)
        : Math.hypot(v.x * normal.x, v.y * normal.y, v.z * normal.z);
      if (along < 60) {
        if (!(ent.flags & EntityFlags.NoStanding) || hit.solid === Solid.Bsp) {
          ent.groundentity = hit;
          ent.groundentity_linkcount = hit.linkcount;
        }
        ent.velocity = { x: 0, y: 0, z: 0 };
        ent.avelocity = { x: 0, y: 0, z: 0 };
        break;
      }
      // Friction for tossed things (gibs and the like).
      if (ent.movetype === MoveType.Toss) {
        ent.velocity = { x: ent.velocity.x * 0.75, y: ent.velocity.y * 0.75, z: ent.velocity.z * 0.75 };
        ent.avelocity = { x: ent.avelocity.x * 0.75, y: ent.avelocity.y * 0.75, z: ent.avelocity.z * 0.75 };
      }
    }

    // Only toss slides more than once.
    if (ent.movetype !== MoveType.Toss) break;
  }

  // Water transitions.
  const wasInWater = (ent.watertype & MASK_WATER) !== 0;
  ent.watertype = sys.pointcontents(ent.origin);
  const isInWater = (ent.watertype & MASK_WATER) !== 0;
  ent.waterlevel = isInWater ? WATER_FEET : WATER_NONE;

  if (ent.svflags & ServerFlags.Monster) {
    M_CatagorizePosition(ent, ent.origin, sys);
    M_WorldEffects(ent, sys);
  } else if (wasInWater !== isInWater) {
    // gi.positioned_sound at the point it went in or came out; the port has no positioned sound.
    void oldOrigin;
    sys.sound(ent, 0, 'misc/h2ohit1.wav', 1, 1, 0);
  }

  // A key dropped into slime or lava is thrown back out, so the level can't be lost.
  if (isInWater && ent.watertype & (CONTENTS_SLIME | CONTENTS_LAVA) && ent.item?.startsWith('key_') && ent.spawnflags & 0x00010000) {
    ent.velocity = { x: sys.rng.crandomOpen() * 300, y: sys.rng.crandomOpen() * 300, z: 300 + sys.rng.crandomOpen() * 300 };
  }

  for (let slave = ent.teamchain; slave; slave = slave.teamchain) {
    slave.origin = { ...ent.origin };
    sys.linkentity(slave);
  }
}
