/**
 * MOVETYPE_PUSH and MOVETYPE_STOP: doors, plats, buttons and trains, ported from the
 * rerelease g_phys.cpp (G_GetClipMask, SV_TestEntityPosition, SV_Push, SV_Physics_Pusher).
 *
 * A pusher moves with its whole team: every part that has velocity is pushed, and if any
 * part is blocked, everything already moved this frame goes back and the blocked part's
 * moveinfo.blocked runs. Only when every part moved do the parts think, which is what lets
 * Move_Calc time a move to the frame.
 */
import {
  CONTENTS_DEADMONSTER,
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  MASK_MONSTERSOLID,
  MASK_PROJECTILE,
  MASK_SHOT,
  angleVectors,
  dotVec3,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, EntityFlags, MoveType, ServerFlags, Solid } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';

/** G_GetClipMask: an entity's clipmask, or the default for its kind. */
export function getClipMask(ent: Entity): number {
  let mask = ent.clipmask;
  if (!mask) {
    if (ent.svflags & ServerFlags.Monster) mask = MASK_MONSTERSOLID;
    else if (ent.svflags & ServerFlags.Projectile) mask = MASK_PROJECTILE;
    else mask = MASK_SHOT & ~CONTENTS_DEADMONSTER;
  }
  // Non-solid objects (items and the like) don't clip against players and monsters.
  if (ent.solid === Solid.Not || ent.solid === Solid.Trigger) mask &= ~(CONTENTS_MONSTER | CONTENTS_PLAYER);
  // Nor do dead monsters and players.
  if (ent.svflags & (ServerFlags.Monster | ServerFlags.Player) && ent.svflags & ServerFlags.DeadMonster)
    mask &= ~(CONTENTS_MONSTER | CONTENTS_PLAYER);
  return mask;
}

/** SV_TestEntityPosition: is the entity stuck in something where it stands? */
export function testEntityPosition(ent: Entity, sys: EntitySystem): boolean {
  const tr = sys.trace(ent.origin, ent.mins, ent.maxs, ent.origin, ent, getClipMask(ent));
  return tr.startsolid;
}

interface Pushed {
  ent: Entity;
  origin: Vec3;
  angles: Vec3;
  rotated: boolean;
  yaw: number;
}

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const isZero = (a: Vec3) => !a.x && !a.y && !a.z;

/**
 * SV_Push: moves the pusher by move and amove, carrying riders and shoving whatever is in
 * the way. On a block, every entity in `pushed` goes back where it was and the obstacle
 * is returned.
 */
function push(pusher: Entity, move: Vec3, amove: Vec3, pushed: Pushed[], sys: EntitySystem): Entity | null {
  const mins = add(pusher.absmin, move);
  const maxs = add(pusher.absmax, move);

  // For carrying things round with the pusher's turn.
  const { forward, right, up } = angleVectors(scale(amove, -1));

  pushed.push({ ent: pusher, origin: { ...pusher.origin }, angles: { ...pusher.angles }, rotated: false, yaw: 0 });

  pusher.origin = add(pusher.origin, move);
  pusher.angles = add(pusher.angles, amove);
  sys.linkentity(pusher);

  // See if any solid entities are inside the final position.
  const capacity = sys.capacity;
  for (let e = 1; e < capacity; e++) {
    const check = sys.getByIndex(e);
    if (!check || !check.inUse || check.freePending) continue;
    if (
      check.movetype === MoveType.Push ||
      check.movetype === MoveType.Stop ||
      check.movetype === MoveType.None ||
      check.movetype === MoveType.Noclip
    )
      continue;
    if (!sys.isLinked(check)) continue;

    // Anything standing on the pusher moves with it; anything else only if it's in the way.
    if (check.groundentity !== pusher) {
      if (
        check.absmin.x >= maxs.x ||
        check.absmin.y >= maxs.y ||
        check.absmin.z >= maxs.z ||
        check.absmax.x <= mins.x ||
        check.absmax.y <= mins.y ||
        check.absmax.z <= mins.z
      )
        continue;
      if (!testEntityPosition(check, sys)) continue;
    }

    if (pusher.movetype === MoveType.Push || check.groundentity === pusher) {
      const rotated = !!amove.y;
      pushed.push({
        ent: check,
        origin: { ...check.origin },
        angles: { ...check.angles },
        rotated,
        yaw: rotated ? pusher.angles.y : 0,
      });

      const oldPosition = { ...check.origin };
      check.origin = add(check.origin, move);
      if (!check.client) check.angles = { ...check.angles, y: check.angles.y + amove.y };

      // The pusher's turn moves the entity round its origin.
      const org = sub(check.origin, pusher.origin);
      const org2 = { x: dotVec3(org, forward), y: -dotVec3(org, right), z: dotVec3(org, up) };
      check.origin = add(check.origin, sub(org2, org));

      // May have pushed them off an edge.
      if (check.groundentity !== pusher) check.groundentity = null;

      let blocked = testEntityPosition(check, sys);

      // [Paril-KEX] a dead player's head may block, or lifts and doors would stick.
      if (blocked && check.client && !check.takedamage) {
        check.origin = oldPosition;
        blocked = false;
      }

      if (!blocked) {
        sys.linkentity(check);
        continue;
      }

      // If it's fine to leave it where it was, do (a rider, not something pushed).
      check.origin = oldPosition;
      if (!testEntityPosition(check, sys)) {
        pushed.pop();
        continue;
      }
    }

    // Blocked: put back everything moved, newest first, so an entity pushed twice ends
    // where it started.
    for (let i = pushed.length - 1; i >= 0; i--) {
      const p = pushed[i];
      p.ent.origin = p.origin;
      p.ent.angles = p.angles;
      if (p.rotated) p.ent.angles = { ...p.ent.angles, y: p.yaw };
      sys.linkentity(p.ent);
    }
    return check;
  }

  // See if anything moved has touched a trigger.
  for (let i = pushed.length - 1; i >= 0; i--) sys.touchTriggers(pushed[i].ent);
  return null;
}

/**
 * SV_Physics_Pusher: moves a team captain and its team, then (if nothing blocked) runs
 * every part's think.
 */
export function physicsPusher(ent: Entity, sys: EntitySystem): void {
  // Team slaves move with their captain.
  if (ent.flags & EntityFlags.TeamSlave) return;

  const frametime = sys.frameTimeSeconds;
  for (let attempts = 0; attempts < 32; attempts++) {
    const pushed: Pushed[] = [];
    let blockedPart: Entity | null = null;
    let obstacle: Entity | null = null;
    for (let part: Entity | null = ent; part; part = part.teamchain) {
      if (isZero(part.velocity) && isZero(part.avelocity)) continue;
      obstacle = push(part, scale(part.velocity, frametime), scale(part.avelocity, frametime), pushed, sys);
      if (obstacle) {
        blockedPart = part;
        break;
      }
    }

    if (blockedPart && obstacle) {
      // Call the blocked function if there is one; otherwise wait for the obstacle to go.
      // The movers not yet ported to movers.ts (plats, trains, rotating and secret doors)
      // still set entity.blocked rather than moveinfo.blocked.
      if (blockedPart.moveinfo?.blocked) blockedPart.moveinfo.blocked(blockedPart, obstacle);
      else blockedPart.blocked?.(blockedPart, obstacle, sys);
      if (!obstacle.inUse || obstacle.freePending) continue; // retry
      return;
    }

    // The move worked, so every part thinks.
    for (let part: Entity | null = ent; part; part = part.teamchain) {
      if (part.inUse) sys.runThink(part);
    }
    return;
  }
}
