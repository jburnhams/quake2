/**
 * How a monster enters the world and stays on the ground, ported from the rerelease
 * g_monster.cpp: M_CheckGround, M_CatagorizePosition, M_WorldEffects, M_droptofloor,
 * monster_start, monster_start_go, the walk/fly/swim starts and trigger-spawned monsters.
 *
 * Every SP_monster_* ends with walkmonster_start, flymonster_start or swimmonster_start, as
 * in the C: monster_start marks it a monster (SVF_MONSTER, MASK_MONSTERSOLID clipmask,
 * takedamage), and a frame later monster_start_go drops it to the floor, unsticks it, picks
 * up its path and sets it thinking.
 */
import {
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  MASK_MONSTERSOLID,
  MASK_WATER,
  fixStuckObjectGeneric,
  type Vec3,
} from '@quake2ts/shared';
import { T_Damage, type Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { Entity, EntityFlags, MoveType, ServerFlags, Solid } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { G_PickTarget } from '../entities/utils.js';
import { KillBox } from '../dm/game.js';
import { getClipMask } from '../physics/pusher.js';
import { AIFlags, SPAWNFLAG_MONSTER_AMBUSH } from './constants.js';
import { M_walkmove } from './movement.js';
import { monster_think } from './monster.js';
import { foundTarget } from './targeting.js';

export const SPAWNFLAG_MONSTER_TRIGGER_SPAWN = 2;
export const SPAWNFLAG_MONSTER_DEAD = 1 << 16;
export const SPAWNFLAG_MONSTER_SUPER_STEP = 1 << 17;
export const SPAWNFLAG_MONSTER_NO_DROP = 1 << 18;
export const SPAWNFLAG_MONSTER_SCENIC = 1 << 19;

/** monsterinfo.aiflags bits the TS AIFlags enum does not name yet. */
const AI_DO_NOT_COUNT = 1 << 21;
const AI_SPAWNED_ALIVE = 1 << 26;
const AI_SPAWNED_DEAD = 1 << 27;

const FRAME_TIME = (sys: EntitySystem) => sys.frameTimeSeconds || 0.025;
const HOLD_FOREVER = Number.MAX_SAFE_INTEGER;

const WATER_NONE = 0;
const WATER_FEET = 1;
const WATER_WAIST = 2;
const WATER_UNDER = 3;

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** M_CheckGround: on the ground if the hull a quarter unit down (along gravity) is solid. */
export function M_CheckGround(ent: Entity, mask: number, sys: EntitySystem): void {
  if (ent.flags & (EntityFlags.Swim | EntityFlags.Fly)) return;

  if (ent.velocity.z * ent.gravityVector.z < -100) {
    ent.groundentity = null;
    return;
  }

  const point = { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z + 0.25 * ent.gravityVector.z };
  const trace = sys.trace(ent.origin, ent.mins, ent.maxs, point, ent, mask);
  const nz = trace.plane?.normal.z ?? 0;

  // Too steep to stand on.
  if (ent.gravityVector.z < 0) {
    if (nz < 0.7 && !trace.startsolid) {
      ent.groundentity = null;
      return;
    }
  } else if (nz > -0.7 && !trace.startsolid) {
    ent.groundentity = null;
    return;
  }

  if (!trace.startsolid && !trace.allsolid) {
    ent.origin = { ...trace.endpos };
    ent.groundentity = trace.ent ?? sys.world;
    ent.groundentity_linkcount = ent.groundentity.linkcount;
    ent.velocity = { ...ent.velocity, z: 0 };
  }
}

/** M_CatagorizePosition: the waterlevel and watertype at a point, for an entity's size. */
export function categorizePosition(self: Entity, inPoint: Vec3, sys: EntitySystem): { waterlevel: number; watertype: number } {
  const point = {
    x: inPoint.x,
    y: inPoint.y,
    z: self.gravityVector.z > 0 ? inPoint.z + self.maxs.z - 1 : inPoint.z + self.mins.z + 1,
  };
  let cont = sys.pointcontents(point);
  if (!(cont & MASK_WATER)) return { waterlevel: WATER_NONE, watertype: 0 };
  const watertype = cont;
  point.z += 26;
  cont = sys.pointcontents(point);
  if (!(cont & MASK_WATER)) return { waterlevel: WATER_FEET, watertype };
  point.z += 22;
  cont = sys.pointcontents(point);
  return { waterlevel: cont & MASK_WATER ? WATER_UNDER : WATER_WAIST, watertype };
}

/** M_CatagorizePosition into the entity's own waterlevel and watertype. */
export function M_CatagorizePosition(self: Entity, inPoint: Vec3, sys: EntitySystem): void {
  const { waterlevel, watertype } = categorizePosition(self, inPoint, sys);
  self.waterlevel = waterlevel;
  self.watertype = watertype;
}

function worldDamage(ent: Entity, damage: number, dflags: number, mod: DamageMod, sys: EntitySystem): void {
  const world = sys.world as unknown as Damageable;
  T_Damage(ent as unknown as Damageable, world, world, ZERO, ent.origin, ZERO, damage, 0, dflags, mod, sys.timeSeconds, sys.multicast.bind(sys));
}

/** M_WorldEffects: drowning, lava and slime, and the sounds of going in and out of water. */
export function M_WorldEffects(ent: Entity, sys: EntitySystem): void {
  const now = sys.timeSeconds;
  if (ent.health > 0) {
    const drown = () => {
      if (ent.pain_debounce_time < now) {
        const dmg = Math.min(15, 2 + Math.trunc(2 * Math.floor(now - ent.air_finished)));
        worldDamage(ent, dmg, DamageFlags.NO_ARMOR, DamageMod.WATER, sys);
        ent.pain_debounce_time = now + 1;
      }
    };
    if (!(ent.flags & EntityFlags.Swim)) {
      if (ent.waterlevel < WATER_UNDER) ent.air_finished = now + 12;
      else if (ent.air_finished < now) drown();
    } else if (ent.waterlevel > WATER_NONE) {
      ent.air_finished = now + 9;
    } else if (ent.air_finished < now) {
      drown(); // suffocate
    }
  }

  if (ent.waterlevel === WATER_NONE) {
    if (ent.flags & EntityFlags.InWater) {
      sys.sound(ent, 2, 'player/watr_out.wav', 1, 1, 0);
      ent.flags &= ~EntityFlags.InWater;
    }
    return;
  }

  if (ent.watertype & CONTENTS_LAVA && !(ent.flags & EntityFlags.ImmuneLava) && ent.damage_debounce_time < now) {
    ent.damage_debounce_time = now + 0.1;
    worldDamage(ent, 10 * ent.waterlevel, DamageFlags.NONE, DamageMod.LAVA, sys);
  }
  if (ent.watertype & CONTENTS_SLIME && !(ent.flags & EntityFlags.ImmuneSlime) && ent.damage_debounce_time < now) {
    ent.damage_debounce_time = now + 0.1;
    worldDamage(ent, 4 * ent.waterlevel, DamageFlags.NONE, DamageMod.SLIME, sys);
  }

  if (!(ent.flags & EntityFlags.InWater)) {
    if (ent.watertype & CONTENTS_LAVA) {
      if (ent.svflags & ServerFlags.Monster && ent.health > 0)
        sys.sound(ent, 2, sys.rng.frandom() <= 0.5 ? 'player/lava1.wav' : 'player/lava2.wav', 1, 1, 0);
      else sys.sound(ent, 2, 'player/watr_in.wav', 1, 1, 0);
    } else if (ent.watertype & (CONTENTS_SLIME | CONTENTS_WATER)) {
      sys.sound(ent, 2, 'player/watr_in.wav', 1, 1, 0);
    }
    ent.flags |= EntityFlags.InWater;
    ent.damage_debounce_time = 0;
  }
}

/** M_droptofloor_generic: moves origin down (or up, for inverted gravity) to the floor. */
export function droptofloorGeneric(
  origin: Vec3,
  mins: Vec3,
  maxs: Vec3,
  ceiling: boolean,
  ignore: Entity,
  mask: number,
  allowPartial: boolean,
  sys: EntitySystem,
): Vec3 | null {
  let start = origin;
  if (sys.trace(start, mins, maxs, start, ignore, mask).startsolid) start = { ...start, z: start.z + (ceiling ? -1 : 1) };
  const end = { ...start, z: start.z + (ceiling ? 256 : -256) };
  const trace = sys.trace(start, mins, maxs, end, ignore, mask);
  if (trace.fraction === 1 || trace.allsolid || (!allowPartial && trace.startsolid)) return null;
  return { ...trace.endpos };
}

/** M_droptofloor */
export function M_droptofloor(ent: Entity, sys: EntitySystem): boolean {
  const mask = getClipMask(ent);
  if (!(ent.spawnflags & SPAWNFLAG_MONSTER_NO_DROP)) {
    const dropped = droptofloorGeneric(ent.origin, ent.mins, ent.maxs, ent.gravityVector.z > 0, ent, mask, true, sys);
    if (!dropped) return false;
    ent.origin = dropped;
  } else if (sys.trace(ent.origin, ent.mins, ent.maxs, ent.origin, ent, mask).startsolid) {
    return false;
  }
  sys.linkentity(ent);
  M_CheckGround(ent, mask, sys);
  M_CatagorizePosition(ent, ent.origin, sys);
  return true;
}

/** monster_use: a monster that is used gets angry at whoever used it. */
export function monster_use(self: Entity, _other: Entity | null, activator: Entity | null, sys: EntitySystem): void {
  if (self.enemy) return;
  if (self.health <= 0) return;
  if (!activator) return;
  if (activator.flags & EntityFlags.NoTarget) return;
  if (!activator.client && !(activator.monsterinfo.aiflags & AIFlags.GoodGuy)) return;
  if (activator.flags & EntityFlags.Disguised) return;
  // delay reaction so if the monster is teleported, its sound is still heard
  self.enemy = activator;
  foundTarget(self, sys.targetAwareness, sys);
}

/** monster_start: what every monster's spawn function ends with. */
export function monster_start(self: Entity, sys: EntitySystem): boolean {
  if (self.spawnflags & SPAWNFLAG_MONSTER_SCENIC) self.monsterinfo.aiflags |= AIFlags.GoodGuy;
  if (self.monsterinfo.aiflags & AIFlags.GoodGuy) self.monsterinfo.aiflags |= AI_DO_NOT_COUNT;

  if (!(self.monsterinfo.aiflags & AI_DO_NOT_COUNT) && !(self.spawnflags & SPAWNFLAG_MONSTER_DEAD)) {
    const level = sys.level as { total_monsters?: number } | undefined;
    if (level) level.total_monsters = (level.total_monsters ?? 0) + 1;
  }

  self.nextthink = sys.timeSeconds + FRAME_TIME(sys);
  self.svflags |= ServerFlags.Monster;
  self.takedamage = true;
  self.air_finished = sys.timeSeconds + 12;
  self.use = (s, other, activator) => monster_use(s, other, activator ?? null, sys);
  self.max_health = self.health;
  self.clipmask = MASK_MONSTERSOLID;
  self.deadflag = 0;
  self.svflags &= ~ServerFlags.DeadMonster;
  self.flags &= ~EntityFlags.AliveKnockbackOnly;
  self.flags |= EntityFlags.CoopHealthScale;
  self.old_origin = { ...self.origin };

  // PMM - get this so I don't have to do it in all of the monsters
  self.monsterinfo.base_height = self.maxs.z;
  // Paril: calculate the viewheight from maxs when a monster has none.
  if (!self.viewheight) self.viewheight = Math.trunc(self.maxs.z - 8);
  return true;
}

function stuckTrace(self: Entity, sys: EntitySystem): boolean {
  return sys.trace(self.origin, self.mins, self.maxs, self.origin, self, MASK_MONSTERSOLID).startsolid;
}

/** G_FixStuckObject */
export function G_FixStuckObject(self: Entity, check: Vec3, sys: EntitySystem): boolean {
  const mask = getClipMask(self);
  const fix = fixStuckObjectGeneric({
    origin: check,
    mins: self.mins,
    maxs: self.maxs,
    trace: (start, mins, maxs, end) => {
      const tr = sys.trace(start, mins, maxs, end, self, mask);
      return { fraction: tr.fraction, endpos: tr.endpos, allsolid: tr.allsolid, startsolid: tr.startsolid, planeNormal: tr.plane?.normal };
    },
  });
  if (fix.result === 'no-good-position') return false;
  self.origin = { ...fix.origin };
  return true;
}

/** monster_start_go: drops the monster to the floor, unsticks it and starts it thinking. */
export function monster_start_go(self: Entity, sys: EntitySystem): void {
  // Paril: moved here so this applies to swim/fly monsters too
  if (!(self.flags & EntityFlags.Stationary)) {
    const check = { ...self.origin };
    const goodGuyOrFloats = self.monsterinfo.aiflags & AIFlags.GoodGuy || self.flags & (EntityFlags.Fly | EntityFlags.Swim);
    let stuck = goodGuyOrFloats ? stuckTrace(self, sys) : !M_droptofloor(self, sys) || !M_walkmove(self, 0, 0, sys);

    if (stuck && G_FixStuckObject(self, check, sys)) {
      if (self.monsterinfo.aiflags & AIFlags.GoodGuy) stuckTrace(self, sys);
      else if (!(self.flags & (EntityFlags.Fly | EntityFlags.Swim))) M_droptofloor(self, sys);
      stuck = false;
    }

    // Last ditch effort: brute force. Paril: this fixes monsters stuck in very shallow slopes.
    if (stuck) {
      const adjust = [0, -1, 1, -2, 2, -4, 4, -8, 8];
      let walked = false;
      for (let y = 0; !walked && y < 3; y++)
        for (let x = 0; !walked && x < 3; x++)
          for (let z = 0; !walked && z < 3; z++) {
            self.origin = { x: check.x + adjust[x], y: check.y + adjust[y], z: check.z + adjust[z] };
            if (self.monsterinfo.aiflags & AIFlags.GoodGuy) {
              stuck = stuckTrace(self, sys);
              if (!stuck) walked = true;
            } else if (!(self.flags & (EntityFlags.Fly | EntityFlags.Swim))) {
              M_droptofloor(self, sys);
              walked = M_walkmove(self, 0, 0, sys);
            }
          }
    }
  }

  if (self.health <= 0) return;

  self.old_origin = { ...self.origin };

  // A target that is a point_combat becomes the combattarget.
  if (self.target) {
    let fixup = false;
    for (const t of sys.findByTargetName(self.target)) if (t.classname === 'point_combat') {
      self.combattarget = self.target;
      fixup = true;
    }
    if (fixup) self.target = undefined;
  }

  const spawnDead = !!(self.spawnflags & SPAWNFLAG_MONSTER_DEAD);
  const stand = () => {
    if (!spawnDead) self.monsterinfo.stand?.(self, sys);
  };

  if (self.target) {
    self.goalentity = self.movetarget = G_PickTarget(self.target, sys);
    if (!self.movetarget) {
      self.target = undefined;
      self.monsterinfo.pausetime = HOLD_FOREVER;
      stand();
    } else if (self.movetarget.classname === 'path_corner') {
      const v = { x: self.goalentity!.origin.x - self.origin.x, y: self.goalentity!.origin.y - self.origin.y };
      const yaw = v.x === 0 && v.y === 0 ? 0 : (Math.atan2(v.y, v.x) * 180) / Math.PI;
      self.ideal_yaw = yaw < 0 ? yaw + 360 : yaw;
      self.angles = { ...self.angles, y: self.ideal_yaw };
      if (!spawnDead) self.monsterinfo.walk?.(self, sys);
      self.target = undefined;
    } else {
      self.goalentity = self.movetarget = null;
      self.monsterinfo.pausetime = HOLD_FOREVER;
      stand();
    }
  } else {
    self.monsterinfo.pausetime = HOLD_FOREVER;
    stand();
  }

  if (spawnDead) {
    // To spawn dead, mimic dying naturally: die, then play the death move through to its end.
    self.health = 0;
    const f = { ...self.origin };
    self.die?.(self, self, self, 0, ZERO, DamageMod.SUICIDE);
    if (!self.inUse) return;
    self.monsterinfo.setskin?.(self);
    self.monsterinfo.aiflags |= AI_SPAWNED_DEAD;

    const move = self.monsterinfo.current_move;
    if (move) {
      for (let i = move.firstframe; i < move.lastframe; i++) {
        self.frame = i;
        move.frames[i - move.firstframe]?.think?.(self, sys);
        if (!self.inUse) return;
      }
      move.endfunc?.(self, sys);
      if (!self.inUse) return;
      self.frame = self.monsterinfo.start_frame || move.lastframe;
    }
    self.origin = f;
    sys.linkentity(self);
    self.monsterinfo.aiflags &= ~AI_SPAWNED_DEAD;
    return;
  }

  self.think = (s) => monster_think(s, sys);
  self.nextthink = sys.timeSeconds + FRAME_TIME(sys);
  self.monsterinfo.aiflags |= AI_SPAWNED_ALIVE;
}

/** monster_triggered_spawn: a trigger-spawned monster appears. */
function monster_triggered_spawn(self: Entity, sys: EntitySystem): void {
  self.origin = { ...self.origin, z: self.origin.z + 1 };
  self.solid = Solid.BoundingBox;
  self.movetype = MoveType.Step;
  self.svflags &= ~ServerFlags.NoClient;
  self.air_finished = sys.timeSeconds + 12;
  sys.linkentity(self);
  KillBox(self, sys);
  monster_start_go(self, sys);

  if (
    self.enemy &&
    !(self.spawnflags & SPAWNFLAG_MONSTER_AMBUSH) &&
    !(self.enemy.flags & EntityFlags.NoTarget) &&
    !(self.monsterinfo.aiflags & AIFlags.GoodGuy) &&
    !(self.enemy.flags & EntityFlags.Disguised)
  ) {
    foundTarget(self, sys.targetAwareness, sys);
  } else {
    self.enemy = null;
  }
}

/** monster_triggered_start: hidden until used. */
export function monster_triggered_start(self: Entity, sys: EntitySystem): void {
  self.solid = Solid.Not;
  self.movetype = MoveType.None;
  self.svflags |= ServerFlags.NoClient;
  self.nextthink = 0;
  self.use = (s, _other, activator) => {
    // A one frame delay so we don't telefrag whoever activated us.
    s.think = (e) => monster_triggered_spawn(e, sys);
    s.nextthink = sys.timeSeconds + FRAME_TIME(sys);
    if (activator?.client) s.enemy = activator;
    s.use = (e, other, act) => monster_use(e, other, act ?? null, sys);
  };
}

function startGo(defaultYawSpeed: number) {
  return (self: Entity, sys: EntitySystem) => {
    if (!self.yaw_speed) self.yaw_speed = defaultYawSpeed;
    if (self.spawnflags & SPAWNFLAG_MONSTER_TRIGGER_SPAWN) monster_triggered_start(self, sys);
    else monster_start_go(self, sys);
  };
}

const walkmonster_start_go = startGo(20);
const flymonster_start_go = startGo(30);
const swimmonster_start_go = startGo(30);

/** walkmonster_start */
export function walkmonster_start(self: Entity, sys: EntitySystem): void {
  self.think = (s) => walkmonster_start_go(s, sys);
  monster_start(self, sys);
}

/** flymonster_start */
export function flymonster_start(self: Entity, sys: EntitySystem): void {
  self.flags |= EntityFlags.Fly;
  self.think = (s) => flymonster_start_go(s, sys);
  monster_start(self, sys);
}

/** swimmonster_start */
export function swimmonster_start(self: Entity, sys: EntitySystem): void {
  self.flags |= EntityFlags.Swim;
  self.think = (s) => swimmonster_start_go(s, sys);
  monster_start(self, sys);
}
