/**
 * Monster movement, ported from the rerelease m_move.cpp: M_CheckBottom, SV_movestep,
 * M_ChangeYaw, SV_StepDirection, SV_NewChaseDir, SV_CloseEnough, M_MoveToGoal and
 * M_walkmove. Monsters move in discrete steps: each step is traced up a stair height, across
 * and down again, and refused if it would leave the floor (except down stairs), wade deeper
 * than the waist, or go into slime or lava.
 *
 * Not ported: Rogue's bad areas (tesla mines, CheckForBadArea) and nav-node path finding
 * (M_NavPathToGoal; the port has no nav data), so M_MoveToPath never takes over.
 */
import {
  CONTENTS_LAVA,
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  CONTENTS_SLIME,
  CONTENTS_SOLID,
  MASK_MONSTERSOLID,
  MASK_SOLID,
  angleMod,
  angleVectors,
  clipVelocityVec3,
  type Vec3,
} from '@quake2ts/shared';
import { Entity, EntityFlags, ServerFlags, Solid } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import type { GameTraceResult } from '../imports.js';
import { getClipMask } from '../physics/pusher.js';
import { AIFlags, AttackState } from './constants.js';
import { M_CheckGround, SPAWNFLAG_MONSTER_SUPER_STEP, categorizePosition } from './monsterStart.js';
import { SV_flystep } from './movement.js';

export const STEPSIZE = 18;
const WATER_WAIST = 2;
const DI_NODIR = -1;

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const length = (a: Vec3) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/** vectoyaw, as the C computes it. */
export function vectoyaw(v: Vec3): number {
  if (v.y === 0 && v.x === 0) return 0;
  let yaw = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  if (yaw < 0) yaw += 360;
  return yaw;
}

/** The 10 Hz design rate's share of a server frame (gi.tick_rate / 10). */
const tickScale = (sys: EntitySystem) => 1 / ((sys.frameTimeSeconds || 0.025) * 10);

/** G_Impact for a trace from a monster's step. */
function impact(e1: Entity, tr: GameTraceResult): void {
  const e2 = tr.ent;
  if (!e2) return;
  if (e1.touch && (e1.solid !== Solid.Not || e1.flags & EntityFlags.AlwaysTouch)) e1.touch(e1, e2, tr.plane, null);
  if (e2.touch && (e2.solid !== Solid.Not || e2.flags & EntityFlags.AlwaysTouch)) e2.touch(e2, e1, tr.plane, null);
}

/** M_CheckBottom_Fast_Generic: every corner under the box is solid world. */
function checkBottomFast(absmins: Vec3, absmaxs: Vec3, ceiling: boolean, sys: EntitySystem): boolean {
  const z = ceiling ? absmaxs.z + 1 : absmins.z - 1;
  for (let x = 0; x <= 1; x++)
    for (let y = 0; y <= 1; y++) {
      const start = { x: x ? absmaxs.x : absmins.x, y: y ? absmaxs.y : absmins.y, z };
      if (sys.pointcontents(start) !== CONTENTS_SOLID) return false;
    }
  return true;
}

/** M_CheckBottom_Slow_Generic: the corners of the floor are within a step of its middle. */
function checkBottomSlow(
  origin: Vec3,
  mins: Vec3,
  maxs: Vec3,
  ignore: Entity,
  mask: number,
  ceiling: boolean,
  allowAnyStepHeight: boolean,
  sys: EntitySystem,
): boolean {
  const quadrant = { x: (maxs.x - mins.x) * 0.5, y: (maxs.y - mins.y) * 0.5, z: 0 };
  const half = scale(quadrant, 0.5);
  const halfMins = scale(half, -1);

  const startZ = ceiling ? origin.z + maxs.z : origin.z + mins.z;
  const stopZ = ceiling ? startZ + STEPSIZE * 2 : startZ - STEPSIZE * 2;
  const minsNoZ = { ...mins, z: 0 };
  const maxsNoZ = { ...maxs, z: 0 };

  let trace = sys.trace({ x: origin.x, y: origin.y, z: startZ }, minsNoZ, maxsNoZ, { x: origin.x, y: origin.y, z: stopZ }, ignore, mask);
  if (trace.fraction === 1) return false;
  // [Paril-KEX]
  if (allowAnyStepHeight) return true;

  const cx = origin.x + (mins.x + maxs.x) * 0.5;
  const cy = origin.y + (mins.y + maxs.y) * 0.5;
  const mid = trace.endpos.z;

  // The corners must be within a step of the midpoint.
  for (let x = 0; x <= 1; x++)
    for (let y = 0; y <= 1; y++) {
      const qs = { x: cx + (x ? half.x : -half.x), y: cy + (y ? half.y : -half.y), z: startZ };
      const qe = { ...qs, z: stopZ };
      trace = sys.trace(qs, halfMins, half, qe, ignore, mask);
      if (ceiling) {
        if (trace.fraction === 1 || trace.endpos.z - mid > STEPSIZE) return false;
      } else if (trace.fraction === 1 || mid - trace.endpos.z > STEPSIZE) {
        return false;
      }
    }
  return true;
}

/** M_CheckBottom: false if any part of the bottom is off an edge that is not a staircase. */
export function M_CheckBottom(ent: Entity, sys: EntitySystem): boolean {
  const ceiling = ent.gravityVector.z > 0;
  if (checkBottomFast(add(ent.origin, ent.mins), add(ent.origin, ent.maxs), ceiling, sys)) return true;
  const mask = ent.svflags & ServerFlags.Monster ? MASK_MONSTERSOLID : MASK_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER;
  return checkBottomSlow(ent.origin, ent.mins, ent.maxs, ent, mask, ceiling, !!(ent.spawnflags & SPAWNFLAG_MONSTER_SUPER_STEP), sys);
}

/**
 * SV_movestep: called by monster programs to move. The move is up a step, across, and down
 * again; it fails (and the monster does not move) if it leaves the floor or is blocked.
 */
export function SV_movestep(ent: Entity, move: Vec3, relink: boolean, sys: EntitySystem): boolean {
  // Flying monsters don't step up.
  if (ent.flags & (EntityFlags.Swim | EntityFlags.Fly)) return SV_flystep(ent, move, relink, sys);

  const oldorg = { ...ent.origin };

  // Push down from a step height above the wished position.
  let stepsize: number;
  if (ent.spawnflags & SPAWNFLAG_MONSTER_SUPER_STEP && ent.health > 0) stepsize = 64;
  else if (!(ent.monsterinfo.aiflags & AIFlags.NoStep)) stepsize = STEPSIZE;
  else stepsize = 1;
  stepsize += 0.75;

  const mask = ent.svflags & ServerFlags.Monster ? MASK_MONSTERSOLID : MASK_SOLID | CONTENTS_MONSTER | CONTENTS_PLAYER;
  const up = scale(ent.gravityVector, -stepsize);

  let startUp = sys.trace(oldorg, ent.mins, ent.maxs, add(oldorg, up), ent, mask).endpos;
  const endUp = add(startUp, move);
  let upTrace = sys.trace(startUp, ent.mins, ent.maxs, endUp, ent, mask);
  if (upTrace.startsolid) {
    startUp = add(startUp, up);
    upTrace = sys.trace(startUp, ent.mins, ent.maxs, endUp, ent, mask);
  }

  const startFwd = oldorg;
  const endFwd = add(startFwd, move);
  let fwdTrace = sys.trace(startFwd, ent.mins, ent.maxs, endFwd, ent, mask);
  if (fwdTrace.startsolid) {
    startUp = add(startUp, up);
    fwdTrace = sys.trace(startFwd, ent.mins, ent.maxs, endFwd, ent, mask);
  }

  // Pick the one that went farther.
  const chosen = upTrace.fraction > fwdTrace.fraction ? upTrace : fwdTrace;
  if (chosen.startsolid || chosen.allsolid) return false;

  const steps = upTrace.fraction > fwdTrace.fraction ? 2 : 1;

  // Step us down.
  const end = add(chosen.endpos, scale(ent.gravityVector, steps * stepsize));
  const trace = sys.trace(chosen.endpos, ent.mins, ent.maxs, end, ent, mask);
  const stepped = Math.abs(ent.origin.z - trace.endpos.z) > 8;

  // Paril: monsters are okay with stepping into water up to their waist, but don't go into
  // deep liquids or slime and lava voluntarily.
  if (ent.waterlevel <= WATER_WAIST) {
    const at = categorizePosition(ent, trace.endpos, sys);
    if (at.watertype & (CONTENTS_SLIME | CONTENTS_LAVA) || at.waterlevel > WATER_WAIST) return false;
  }

  if (trace.fraction === 1) {
    // If the monster had the ground pulled out, go ahead and fall.
    if (ent.flags & EntityFlags.PartialGround) {
      ent.origin = add(ent.origin, move);
      if (relink) {
        sys.linkentity(ent);
        sys.touchTriggers(ent);
      }
      ent.groundentity = null;
      return true;
    }
    // [Paril-KEX] allow dead monsters to "fall" off of edges in their death animation
    if (!(ent.spawnflags & SPAWNFLAG_MONSTER_SUPER_STEP) && ent.health > 0) return false; // walked off an edge
  }

  // [Paril-KEX] if we didn't move at all (or barely moved), don't count it.
  if (length(sub(trace.endpos, oldorg)) < length(move) * 0.05) {
    ent.monsterinfo.bad_move_time = sys.timeSeconds + 1;
    if ((ent.monsterinfo.bump_time ?? 0) < sys.timeSeconds && chosen.fraction < 1 && chosen.plane) {
      // Adjust ideal_yaw to move against the object we hit and try again.
      const forward = angleVectors({ x: 0, y: ent.ideal_yaw, z: 0 }).forward;
      const dir = clipVelocityVec3(forward, chosen.plane.normal, 1);
      const newYaw = vectoyaw(dir);
      if (dir.x * dir.x + dir.y * dir.y + dir.z * dir.z > 0.1 && ent.ideal_yaw !== newYaw) {
        ent.ideal_yaw = newYaw;
        ent.monsterinfo.random_change_time = sys.timeSeconds + 0.1;
        ent.monsterinfo.bump_time = sys.timeSeconds + 0.2;
        return true;
      }
    }
    return false;
  }

  // Check point traces down for dangling corners.
  ent.origin = { ...trace.endpos };

  if (!M_CheckBottom(ent, sys)) {
    if (ent.flags & EntityFlags.PartialGround) {
      // The entity had its floor mostly pulled out from underneath it and is trying to correct.
      if (relink) {
        sys.linkentity(ent);
        sys.touchTriggers(ent);
      }
      return true;
    }
    // Walked off an edge that wasn't a stairway.
    ent.origin = oldorg;
    return false;
  }

  if (ent.spawnflags & SPAWNFLAG_MONSTER_SUPER_STEP && ent.health > 0) {
    if (!ent.groundentity || ent.groundentity.solid === Solid.Bsp) {
      if (!trace.ent || trace.ent.solid !== Solid.Bsp) {
        ent.origin = oldorg;
        M_CheckGround(ent, getClipMask(ent), sys);
        return false;
      }
    }
  }

  // [Paril-KEX]
  M_CheckGround(ent, getClipMask(ent), sys);
  if (!ent.groundentity) {
    // Walked off an edge.
    ent.origin = oldorg;
    M_CheckGround(ent, getClipMask(ent), sys);
    return false;
  }

  ent.flags &= ~EntityFlags.PartialGround;
  ent.groundentity = trace.ent ?? sys.world;
  ent.groundentity_linkcount = ent.groundentity.linkcount;

  // The move is ok.
  if (relink) {
    sys.linkentity(ent);
    sys.touchTriggers(ent);
  }

  if (stepped) ent.renderfx |= 1 << 18; // RF_STAIR_STEP
  if (trace.fraction < 1) impact(ent, trace);
  return true;
}

/** M_ChangeYaw: turns toward ideal_yaw at yaw_speed degrees per 10 Hz frame. */
export function M_ChangeYaw(ent: Entity, sys: EntitySystem): void {
  const current = angleMod(ent.angles.y);
  const ideal = ent.ideal_yaw;
  if (current === ideal) return;

  let move = ideal - current;
  // [Paril-KEX] high tick rate
  const speed = ent.yaw_speed / tickScale(sys);
  if (ideal > current) {
    if (move >= 180) move -= 360;
  } else if (move <= -180) {
    move += 360;
  }
  if (move > 0) {
    if (move > speed) move = speed;
  } else if (move < -speed) {
    move = -speed;
  }
  ent.angles = { ...ent.angles, y: angleMod(current + move) };
}

/** FacingIdeal */
export function FacingIdeal(self: Entity): boolean {
  const delta = angleMod(self.angles.y - self.ideal_yaw);
  if (self.monsterinfo.aiflags & AIFlags.Pathing) return !(delta > 5 && delta < 355);
  return !(delta > 45 && delta < 315);
}

/** SV_StepDirection: turns to the movement direction, and walks the distance if facing it. */
export function SV_StepDirection(ent: Entity, yaw: number, dist: number, allowNoTurns: boolean, sys: EntitySystem): boolean {
  if (!ent.inUse) return true; // PGM g_touchtrigger free problem

  const oldIdealYaw = ent.ideal_yaw;
  const oldCurrentYaw = ent.angles.y;

  ent.ideal_yaw = yaw;
  M_ChangeYaw(ent, sys);

  const rad = (yaw * Math.PI * 2) / 360;
  const move = { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, z: 0 };

  const oldorigin = { ...ent.origin };
  if (SV_movestep(ent, move, false, sys)) {
    ent.monsterinfo.aiflags &= ~AIFlags.Blocked;
    if (!ent.inUse) return true;
    if (!ent.classname?.startsWith('monster_widow')) {
      if (!FacingIdeal(ent)) {
        // Not turned far enough, so don't take the step, but still turn.
        ent.origin = oldorigin;
        M_CheckGround(ent, getClipMask(ent), sys);
        return allowNoTurns; // [Paril-KEX]
      }
    }
    sys.linkentity(ent);
    sys.touchTriggers(ent);
    return true;
  }
  sys.linkentity(ent);
  sys.touchTriggers(ent);
  ent.ideal_yaw = oldIdealYaw;
  ent.angles = { ...ent.angles, y: oldCurrentYaw };
  return false;
}

/** SV_FixCheckBottom */
function SV_FixCheckBottom(ent: Entity): void {
  ent.flags |= EntityFlags.PartialGround;
}

/** SV_NewChaseDir: picks a new direction toward pos when the straight one is blocked. */
export function SV_NewChaseDir(actor: Entity, pos: Vec3, dist: number, sys: EntitySystem): boolean {
  const olddir = angleMod(Math.trunc(actor.ideal_yaw / 45) * 45);
  const turnaround = angleMod(olddir - 180);

  const deltax = pos.x - actor.origin.x;
  const deltay = pos.y - actor.origin.y;
  const d = [0, deltax > 10 ? 0 : deltax < -10 ? 180 : DI_NODIR, deltay < -10 ? 270 : deltay > 10 ? 90 : DI_NODIR];

  // Try the direct route.
  if (d[1] !== DI_NODIR && d[2] !== DI_NODIR) {
    const tdir = d[1] === 0 ? (d[2] === 90 ? 45 : 315) : d[2] === 90 ? 135 : 215;
    if (tdir !== turnaround && SV_StepDirection(actor, tdir, dist, false, sys)) return true;
  }

  // Try other directions.
  if (sys.rng.frandom() < 0.5 || Math.abs(deltay) > Math.abs(deltax)) {
    const t = d[1];
    d[1] = d[2];
    d[2] = t;
  }
  if (d[1] !== DI_NODIR && d[1] !== turnaround && SV_StepDirection(actor, d[1], dist, false, sys)) return true;
  if (d[2] !== DI_NODIR && d[2] !== turnaround && SV_StepDirection(actor, d[2], dist, false, sys)) return true;

  // ROGUE
  const blocked = actor.monsterinfo.blocked;
  if (blocked && actor.inUse && actor.health > 0 && !(actor.monsterinfo.aiflags & AIFlags.TargetAnger)) {
    // If the block "succeeds", the actor will not move or turn.
    if (blocked(actor, dist, sys)) {
      actor.monsterinfo.move_block_counter = -2;
      return true;
    }
    // We couldn't step; the C switches to node navigation for a while here.
    const navBlocked = AIFlags.LostSight | AIFlags.CombatPoint | AIFlags.TargetAnger | AIFlags.Pathing | AIFlags.TempMeleeCombat;
    if (!(actor.monsterinfo.aiflags & navBlocked)) {
      actor.monsterinfo.move_block_counter = (actor.monsterinfo.move_block_counter ?? 0) + 1;
      if (actor.monsterinfo.move_block_counter > 2) {
        actor.monsterinfo.aiflags |= AIFlags.TempMeleeCombat;
        actor.monsterinfo.move_block_change_time = sys.timeSeconds + 3;
        actor.monsterinfo.move_block_counter = 0;
      }
    }
  }

  // There is no direct path to the player, so pick another direction.
  if (olddir !== DI_NODIR && SV_StepDirection(actor, olddir, dist, false, sys)) return true;

  // Randomly determine the direction of the search.
  if (sys.rng.frandom() < 0.5) {
    for (let tdir = 0; tdir <= 315; tdir += 45)
      if (tdir !== turnaround && SV_StepDirection(actor, tdir, dist, false, sys)) return true;
  } else {
    for (let tdir = 315; tdir >= 0; tdir -= 45)
      if (tdir !== turnaround && SV_StepDirection(actor, tdir, dist, false, sys)) return true;
  }

  if (turnaround !== DI_NODIR && SV_StepDirection(actor, turnaround, dist, false, sys)) return true;

  actor.ideal_yaw = sys.rng.frandom() * 360; // can't move; pick a random yaw...

  // If a bridge was pulled out from underneath a monster, it may not have a valid standing
  // position at all.
  if (!M_CheckBottom(actor, sys)) SV_FixCheckBottom(actor);
  return false;
}

/** SV_CloseEnough: the boxes are within dist of each other on every axis. */
export function SV_CloseEnough(ent: Entity, goal: Entity, dist: number): boolean {
  for (const k of ['x', 'y', 'z'] as const) {
    if (goal.absmin[k] > ent.absmax[k] + dist) return false;
    if (goal.absmax[k] < ent.absmin[k] - dist) return false;
  }
  return true;
}

const boxesIntersect = (amin: Vec3, amax: Vec3, bmin: Vec3, bmax: Vec3) =>
  amin.x <= bmax.x && amax.x >= bmin.x && amin.y <= bmax.y && amax.y >= bmin.y && amin.z <= bmax.z && amax.z >= bmin.z;

/** M_MoveToGoal: steps toward goalentity, going round what is in the way. */
export function M_MoveToGoal(ent: Entity, dist: number, sys: EntitySystem): void {
  const goal = ent.goalentity;
  if (!ent.groundentity && !(ent.flags & (EntityFlags.Fly | EntityFlags.Swim))) return;
  if (!goal) return;

  // [Paril-KEX] the C tries nav paths here (M_MoveToPath); the port has no nav data.
  ent.monsterinfo.aiflags &= ~AIFlags.Pathing;

  // [Paril-KEX] in some n64 maps the corners are too high; drop them to the monster's level.
  if (
    !(goal.flags & EntityFlags.PartialGround) &&
    !(ent.flags & (EntityFlags.Fly | EntityFlags.Swim)) &&
    (goal.classname === 'path_corner' || goal.classname === 'point_combat')
  ) {
    const p = { ...goal.origin, z: ent.origin.z };
    if (boxesIntersect(ent.absmin, ent.absmax, p, p)) {
      goal.flags |= EntityFlags.PartialGround;
      if (!boxesIntersect(ent.absmin, ent.absmax, goal.origin, goal.origin)) {
        goal.origin = { ...goal.origin, z: p.z };
        sys.linkentity(goal);
      }
    }
  }

  const now = sys.timeSeconds;

  // [Paril-KEX] with a straight shot to the target, just move straight instead of sticking
  // to invisible guide lines.
  if ((ent.monsterinfo.bad_move_time ?? 0) <= now || ent.monsterinfo.aiflags & AIFlags.Charging) {
    if (!FacingIdeal(ent)) {
      M_ChangeYaw(ent, sys);
      return;
    }
    const tr = sys.trace(ent.origin, null, null, goal.origin, ent, MASK_MONSTERSOLID);
    if (tr.fraction === 1 || tr.ent === goal) {
      if (SV_StepDirection(ent, vectoyaw(sub(goal.origin, ent.origin)), dist, false, sys)) return;
    }
    // We didn't make a step, so don't try this for a while, unless going to a path corner.
    if (goal.classname !== 'path_corner' && goal.classname !== 'point_combat') {
      ent.monsterinfo.bad_move_time = now + 5;
      ent.monsterinfo.aiflags &= ~AIFlags.Charging;
    }
  }

  // Bump around...
  const randomBump =
    (ent.monsterinfo.random_change_time ?? 0) <= now &&
    Math.floor(sys.rng.frandom() * 4) === 1 &&
    !(ent.monsterinfo.aiflags & AIFlags.Charging) &&
    !(ent.monsterinfo.aiflags & AIFlags.AlternateFly && ent.enemy && !(ent.monsterinfo.aiflags & AIFlags.LostSight));
  if (randomBump || !SV_StepDirection(ent, ent.ideal_yaw, dist, (ent.monsterinfo.bad_move_time ?? 0) > now, sys)) {
    if (ent.monsterinfo.aiflags & AIFlags.Blocked) {
      ent.monsterinfo.aiflags &= ~AIFlags.Blocked;
      return;
    }
    ent.monsterinfo.random_change_time = now + 0.5 + sys.rng.frandom() * 0.5;
    SV_NewChaseDir(ent, goal.origin, dist, sys);
    ent.monsterinfo.move_block_counter = 0;
  } else {
    ent.monsterinfo.bad_move_time = (ent.monsterinfo.bad_move_time ?? 0) - 0.25;
  }
}

/** M_walkmove: one step along a yaw, if the monster is on the ground (or flies or swims). */
export function M_walkmove(ent: Entity, yaw: number, dist: number, sys: EntitySystem): boolean {
  if (!ent.groundentity && !(ent.flags & (EntityFlags.Fly | EntityFlags.Swim))) return false;
  const rad = (yaw * Math.PI * 2) / 360;
  const move = { x: Math.cos(rad) * dist, y: Math.sin(rad) * dist, z: 0 };
  const retval = SV_movestep(ent, move, true, sys);
  ent.monsterinfo.aiflags &= ~AIFlags.Blocked;
  return retval;
}

export { AttackState };
