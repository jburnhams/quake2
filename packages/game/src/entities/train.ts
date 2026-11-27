/**
 * func_train, ported from the rerelease g_func.cpp.
 *
 * A train spawns where its first path_corner is (the corner names the train's min point, unless
 * USE_ORIGIN), a frame after its own spawn so its targets exist (func_train_find). Untargeted, it
 * starts at once; otherwise it waits to be used. From each corner it moves to the next with
 * Move_Calc at its speed (a corner's speed, accel and decel change them), waits the corner's
 * "wait" (-1 with TOGGLE stops until used again), fires the corner's pathtarget, and jumps
 * straight to a TELEPORT corner. MOVE_TEAMCHAIN carries its team along.
 */
import { ServerCommand, TempEntity, type Vec3 } from '@quake2ts/shared';
import { T_Damage, type Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { MulticastType } from '../imports.js';
import { Entity, MoveType, ServerFlags, Solid } from './entity.js';
import { STATE_TOP, moveCalc, moveinfo } from './movers.js';
import { SPAWNFLAG_PATH_CORNER_TELEPORT } from './paths.js';
import type { SpawnFunction } from './spawn.js';
import type { EntitySystem } from './system.js';
import { G_PickTarget } from './utils.js';

export const SPAWNFLAG_TRAIN_START_ON = 1;
export const SPAWNFLAG_TRAIN_TOGGLE = 2;
export const SPAWNFLAG_TRAIN_BLOCK_STOPS = 4;
export const SPAWNFLAG_TRAIN_MOVE_TEAMCHAIN = 8;
export const SPAWNFLAG_TRAIN_FIX_OFFSET = 16;
export const SPAWNFLAG_TRAIN_USE_ORIGIN = 32;

const ATTN_NONE = 0;
const ATTN_STATIC = 3;
/** EV_OTHER_TELEPORT */
const EV_OTHER_TELEPORT = 7;
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

/** Where the train goes for a corner: its origin, or the corner less the train's mins. */
function cornerDest(self: Entity, corner: Entity): Vec3 {
  if (self.spawnflags & SPAWNFLAG_TRAIN_USE_ORIGIN) return { ...corner.origin };
  let dest = { x: corner.origin.x - self.mins.x, y: corner.origin.y - self.mins.y, z: corner.origin.z - self.mins.z };
  if (self.spawnflags & SPAWNFLAG_TRAIN_FIX_OFFSET) dest = { x: dest.x - 1, y: dest.y - 1, z: dest.z - 1 };
  return dest;
}

function damage(targ: Entity, train: Entity, amount: number, sys: EntitySystem): void {
  if (!targ.takedamage) return;
  T_Damage(
    targ as unknown as Damageable,
    train as unknown as Damageable,
    train as unknown as Damageable,
    ZERO,
    targ.origin,
    ZERO,
    amount,
    1,
    DamageFlags.NONE,
    DamageMod.CRUSH,
    sys.timeSeconds,
    sys.multicast.bind(sys),
  );
}

/** BecomeExplosion1 */
function becomeExplosion1(self: Entity, sys: EntitySystem): void {
  sys.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.EXPLOSION1, self.origin);
  sys.free(self);
}

/** train_blocked */
function trainBlocked(self: Entity, other: Entity, sys: EntitySystem): void {
  if (!(other.svflags & ServerFlags.Monster) && !other.client) {
    // give it a chance to go away on it's own terms (like gibs)
    damage(other, self, 100000, sys);
    // if it's still there, nuke it
    if (other.inUse && other.solid) becomeExplosion1(other, sys);
    return;
  }
  if (sys.timeSeconds < self.touch_debounce_time) return;
  if (!self.dmg) return;
  self.touch_debounce_time = sys.timeSeconds + 0.5;
  damage(other, self, self.dmg, sys);
}

/** train_wait */
function trainWait(self: Entity, sys: EntitySystem): void {
  const corner = self.target_ent!;
  if (corner.pathtarget) {
    const savetarget = corner.target;
    corner.target = corner.pathtarget;
    sys.useTargets(corner, self.activator);
    corner.target = savetarget;
    // make sure we didn't get killed by a killtarget
    if (!self.inUse) return;
  }

  const mi = moveinfo(self);
  if (mi.wait) {
    if (mi.wait > 0) {
      self.nextthink = sys.timeSeconds + mi.wait;
      self.think = (e) => trainNext(e, sys);
    } else if (self.spawnflags & SPAWNFLAG_TRAIN_TOGGLE) {
      // PMM - clear target_ent, let train_next get called when we get used
      self.target_ent = null;
      self.spawnflags &= ~SPAWNFLAG_TRAIN_START_ON;
      self.velocity = { ...ZERO };
      self.nextthink = 0;
    }
    // (moveinfo.sound_end: a train never has one, so there is nothing to play)
    self.sound = 0;
  } else {
    trainNext(self, sys);
  }
}

/** train_next */
export function trainNext(self: Entity, sys: EntitySystem): void {
  let first = true;
  let corner: Entity | null;
  for (;;) {
    if (!self.target) {
      self.sound = 0;
      return;
    }
    corner = G_PickTarget(self.target, sys);
    if (!corner) return; // train_next: bad target
    self.target = corner.target;

    // check for a teleport path_corner
    if (!(corner.spawnflags & SPAWNFLAG_PATH_CORNER_TELEPORT)) break;
    if (!first) return; // connected teleport path_corners
    first = false;
    self.origin = cornerDest(self, corner);
    self.old_origin = { ...self.origin };
    self.event = EV_OTHER_TELEPORT;
    sys.linkentity(self);
  }

  const mi = moveinfo(self);
  // PGM
  if (corner.speed) {
    self.speed = corner.speed;
    mi.speed = corner.speed;
    mi.accel = corner.accel ? corner.accel : corner.speed;
    mi.decel = corner.decel ? corner.decel : corner.speed;
    mi.current_speed = 0;
  }
  // PGM

  mi.wait = corner.wait;
  self.target_ent = corner;

  // (moveinfo.sound_start: a train never has one, so there is nothing to play)
  self.sound = mi.sound_middle ?? 0;

  const dest = cornerDest(self, corner);
  mi.state = STATE_TOP;
  mi.start_origin = { ...self.origin };
  mi.end_origin = { ...dest };
  moveCalc(self, dest, (e) => trainWait(e, sys), sys);
  self.spawnflags |= SPAWNFLAG_TRAIN_START_ON;

  // PGM
  if (self.spawnflags & SPAWNFLAG_TRAIN_MOVE_TEAMCHAIN) {
    const dir = { x: dest.x - self.origin.x, y: dest.y - self.origin.y, z: dest.z - self.origin.z };
    for (let e = self.teamchain; e; e = e.teamchain) {
      const dst = { x: dir.x + e.origin.x, y: dir.y + e.origin.y, z: dir.z + e.origin.z };
      const emi = moveinfo(e);
      emi.start_origin = { ...e.origin };
      emi.end_origin = dst;
      emi.state = STATE_TOP;
      e.speed = self.speed;
      emi.speed = mi.speed;
      emi.accel = mi.accel;
      emi.decel = mi.decel;
      e.movetype = MoveType.Push;
      moveCalc(e, dst, () => {}, sys); // train_piece_wait
    }
  }
  // PGM
}

/** train_resume */
function trainResume(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  const dest = cornerDest(self, self.target_ent!);
  self.sound = mi.sound_middle ?? 0;
  mi.state = STATE_TOP;
  mi.start_origin = { ...self.origin };
  mi.end_origin = { ...dest };
  moveCalc(self, dest, (e) => trainWait(e, sys), sys);
  self.spawnflags |= SPAWNFLAG_TRAIN_START_ON;
}

/** func_train_find */
function funcTrainFind(self: Entity, sys: EntitySystem): void {
  if (!self.target) return; // train_find: no target
  const corner = G_PickTarget(self.target, sys);
  if (!corner) return; // train_find: target not found
  self.target = corner.target;
  self.origin = cornerDest(self, corner);
  sys.linkentity(self);

  // if not triggered, start immediately
  if (!self.targetname) self.spawnflags |= SPAWNFLAG_TRAIN_START_ON;

  if (self.spawnflags & SPAWNFLAG_TRAIN_START_ON) {
    self.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
    self.think = (e) => trainNext(e, sys);
    self.activator = self;
  }
}

/** train_use */
function trainUse(self: Entity, activator: Entity | null, sys: EntitySystem): void {
  self.activator = activator;
  if (self.spawnflags & SPAWNFLAG_TRAIN_START_ON) {
    if (!(self.spawnflags & SPAWNFLAG_TRAIN_TOGGLE)) return;
    self.spawnflags &= ~SPAWNFLAG_TRAIN_START_ON;
    self.velocity = { ...ZERO };
    self.nextthink = 0;
  } else if (self.target_ent) {
    trainResume(self, sys);
  } else {
    trainNext(self, sys);
  }
}

/** SP_func_train */
export const SP_func_train: SpawnFunction = (self, context) => {
  const sys = context.entities;
  const keys = context.keyValues ?? {};
  self.movetype = MoveType.Push;
  self.angles = { ...ZERO };
  const mi = moveinfo(self);
  mi.blocked = (e, other) => trainBlocked(e, other, sys);
  if (self.spawnflags & SPAWNFLAG_TRAIN_BLOCK_STOPS) self.dmg = 0;
  else if (!self.dmg) self.dmg = 100;
  self.solid = Solid.Bsp;
  if (self.model) sys.setModel(self, self.model);

  if (keys.noise) {
    mi.sound_middle = sys.soundIndex(keys.noise);
    // [Paril-KEX] for rhangar1 doors (s.loop_attenuation is not in the port's entity state)
    if (keys.attenuation === undefined) self.attenuation = ATTN_STATIC;
    else if (self.attenuation === -1) self.attenuation = ATTN_NONE;
  }

  if (!self.speed) self.speed = 100;
  mi.speed = self.speed;
  mi.accel = mi.decel = mi.speed;

  self.use = (e, _other, activator) => trainUse(e, activator ?? null, sys);

  sys.linkentity(self);

  if (self.target) {
    // start trains on the second frame, to make sure their targets have had
    // a chance to spawn
    self.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
    self.think = (e) => funcTrainFind(e, sys);
  }
};
