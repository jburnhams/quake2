/**
 * func_door and func_button, ported from the rerelease g_func.cpp.
 *
 * A door with no targetname and no health opens when a player or monster walks into the
 * trigger field it spawns around its team (Think_SpawnDoorTrigger); one with a targetname
 * waits to be used; one with health must be shot. Doors that share a "team" key move
 * together and finish together (Think_CalcMoveSpeed). A button moves in when touched,
 * used or shot, fires its targets, and returns after "wait" seconds.
 *
 * Not yet ported here: func_door_rotating, func_water and func_door_secret (still in
 * funcs.ts), area portals (visibility only), and bmodel_anim.
 */
import { CONTENTS_SOLID, type Vec3 } from '@quake2ts/shared';
import { T_Damage, type Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { Entity, EntityFlags, MoveType, ServerFlags, Solid } from './entity.js';
import { EntityEffects } from './enums.js';
import { STATE_BOTTOM, STATE_DOWN, STATE_TOP, STATE_UP, moveCalc, moveinfo } from './movers.js';
import type { SpawnFunction, SpawnRegistry } from './spawn.js';
import type { EntitySystem } from './system.js';
import { setMovedir } from './utils.js';

export const SPAWNFLAG_DOOR_START_OPEN = 1;
export const SPAWNFLAG_DOOR_CRUSHER = 4;
export const SPAWNFLAG_DOOR_NOMONSTER = 8;
export const SPAWNFLAG_DOOR_ANIMATED = 16;
export const SPAWNFLAG_DOOR_TOGGLE = 32;
export const SPAWNFLAG_DOOR_ANIMATED_FAST = 64;

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });

/** The sounds a mover plays, by name (moveinfo keeps sound indexes in the original). */
interface MoverSounds {
  start?: string;
  middle?: string;
  end?: string;
}
const moverSounds = new WeakMap<Entity, MoverSounds>();

/** G_SetMoveinfoSounds: a "noise_*" key overrides the default; "" or "0" means none. */
function setMoveinfoSounds(ent: Entity, keys: Record<string, string>, start?: string, middle?: string, end?: string): void {
  const pick = (fallback: string | undefined, wanted: string | undefined) => {
    if (wanted === undefined) return fallback;
    if (!wanted || wanted[0] === '0' || wanted[0] === ' ') return undefined;
    return wanted;
  };
  moverSounds.set(ent, {
    start: pick(start, keys.noise_start),
    middle: pick(middle, keys.noise_middle),
    end: pick(end, keys.noise_end),
  });
}

const sounds = (ent: Entity): MoverSounds => moverSounds.get(ent) ?? {};

/** CHAN_NO_PHS_ADD | CHAN_VOICE */
const MOVER_CHANNEL = 8 | 2;
const ATTN_STATIC = 3;

/** door_play_sound: from the middle of the team, unless that is inside a wall. */
function doorPlaySound(self: Entity, sound: string, sys: EntitySystem): void {
  if (!self.teammaster) {
    sys.sound(self, MOVER_CHANNEL, sound, 1, ATTN_STATIC, 0);
    return;
  }
  let p: Vec3 = ZERO;
  let c = 0;
  for (let t: Entity | null = self.teammaster; t; t = t.teamchain) {
    p = add(p, scale(add(t.absmin, t.absmax), 0.5));
    c++;
  }
  if (c === 1 || sys.pointcontents(scale(p, 1 / c)) & CONTENTS_SOLID) {
    sys.sound(self, MOVER_CHANNEL, sound, 1, ATTN_STATIC, 0);
    return;
  }
  // gi.positioned_sound: the port's engine has no positioned sound, so play it on the door.
  sys.sound(self, MOVER_CHANNEL, sound, 1, ATTN_STATIC, 0);
}

function doorHitTop(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  if (!(self.flags & EntityFlags.TeamSlave)) {
    const end = sounds(self).end;
    if (end) doorPlaySound(self, end, sys);
  }
  mi.state = STATE_TOP;
  if (self.spawnflags & SPAWNFLAG_DOOR_TOGGLE) return;
  if ((mi.wait ?? 0) >= 0) {
    self.think = (e) => doorGoDown(e, sys);
    self.nextthink = sys.timeSeconds + (mi.wait ?? 0);
  }
}

function doorHitBottom(self: Entity, sys: EntitySystem): void {
  if (!(self.flags & EntityFlags.TeamSlave)) {
    const end = sounds(self).end;
    if (end) doorPlaySound(self, end, sys);
  }
  moveinfo(self).state = STATE_BOTTOM;
}

export function doorGoDown(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  if (!(self.flags & EntityFlags.TeamSlave)) {
    const start = sounds(self).start;
    if (start) doorPlaySound(self, start, sys);
  }
  if (self.max_health) {
    self.takedamage = true;
    self.health = self.max_health;
  }
  mi.state = STATE_DOWN;
  moveCalc(self, mi.start_origin!, (e) => doorHitBottom(e, sys), sys);
}

export function doorGoUp(self: Entity, activator: Entity | null, sys: EntitySystem): void {
  const mi = moveinfo(self);
  if (mi.state === STATE_UP) return; // already going up
  if (mi.state === STATE_TOP) {
    // reset top wait time
    if ((mi.wait ?? 0) >= 0) self.nextthink = sys.timeSeconds + (mi.wait ?? 0);
    return;
  }
  if (!(self.flags & EntityFlags.TeamSlave)) {
    const start = sounds(self).start;
    if (start) doorPlaySound(self, start, sys);
  }
  mi.state = STATE_UP;
  moveCalc(self, mi.end_origin!, (e) => doorHitTop(e, sys), sys);
  sys.useTargets(self, activator);
}

export function doorUse(self: Entity, _other: Entity | null, activator: Entity | null, sys: EntitySystem): void {
  if (self.flags & EntityFlags.TeamSlave) return;
  const mi = moveinfo(self);
  if (self.spawnflags & SPAWNFLAG_DOOR_TOGGLE && (mi.state === STATE_UP || mi.state === STATE_TOP)) {
    // trigger all paired doors
    for (let ent: Entity | null = self; ent; ent = ent.teamchain) {
      ent.message = undefined as unknown as string;
      ent.touch = undefined;
      doorGoDown(ent, sys);
    }
    return;
  }
  // trigger all paired doors
  for (let ent: Entity | null = self; ent; ent = ent.teamchain) {
    ent.message = undefined as unknown as string;
    ent.touch = undefined;
    doorGoUp(ent, activator, sys);
  }
}

function touchDoorTrigger(self: Entity, other: Entity | null, sys: EntitySystem): void {
  if (!other || other.health <= 0) return;
  if (!(other.svflags & ServerFlags.Monster) && !other.client) return;
  const owner = self.owner;
  if (!owner) return;
  if (owner.spawnflags & SPAWNFLAG_DOOR_NOMONSTER && other.svflags & ServerFlags.Monster) return;
  if (sys.timeSeconds < self.touch_debounce_time) return;
  self.touch_debounce_time = sys.timeSeconds + 1;
  doorUse(owner, other, other, sys);
}

/** Think_CalcMoveSpeed: slows each team member so they all finish together. */
function calcMoveSpeed(self: Entity): void {
  if (self.flags & EntityFlags.TeamSlave) return; // only the team master does this
  let min = Math.abs(moveinfo(self).distance ?? 0);
  for (let ent = self.teamchain; ent; ent = ent.teamchain) {
    const dist = Math.abs(moveinfo(ent).distance ?? 0);
    if (dist < min) min = dist;
  }
  const time = min / (moveinfo(self).speed ?? 1);
  for (let ent: Entity | null = self; ent; ent = ent.teamchain) {
    const mi = moveinfo(ent);
    const newspeed = Math.abs(mi.distance ?? 0) / time;
    const ratio = newspeed / (mi.speed ?? 1);
    if (mi.accel === mi.speed) mi.accel = newspeed;
    else mi.accel = (mi.accel ?? 0) * ratio;
    if (mi.decel === mi.speed) mi.decel = newspeed;
    else mi.decel = (mi.decel ?? 0) * ratio;
    mi.speed = newspeed;
  }
}

/** Think_SpawnDoorTrigger: a trigger round the whole team, 60 units wider each side. */
function spawnDoorTrigger(ent: Entity, sys: EntitySystem): void {
  if (ent.flags & EntityFlags.TeamSlave) return; // only the team leader spawns a trigger
  const mins = { ...ent.absmin };
  const maxs = { ...ent.absmax };
  for (let other = ent.teamchain; other; other = other.teamchain) {
    for (const p of [other.absmin, other.absmax]) {
      mins.x = Math.min(mins.x, p.x);
      mins.y = Math.min(mins.y, p.y);
      mins.z = Math.min(mins.z, p.z);
      maxs.x = Math.max(maxs.x, p.x);
      maxs.y = Math.max(maxs.y, p.y);
      maxs.z = Math.max(maxs.z, p.z);
    }
  }
  mins.x -= 60;
  mins.y -= 60;
  maxs.x += 60;
  maxs.y += 60;

  const other = sys.spawn();
  other.classname = 'door_trigger';
  other.mins = mins;
  other.maxs = maxs;
  other.owner = ent;
  other.solid = Solid.Trigger;
  other.movetype = MoveType.None;
  other.touch = (self, toucher) => touchDoorTrigger(self, toucher, sys);
  sys.linkentity(other);

  calcMoveSpeed(ent);
}

function doorBlocked(self: Entity, other: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  if (!(other.svflags & ServerFlags.Monster) && !other.client) {
    // give it a chance to go away on its own terms (like gibs)
    crush(other, self, 100000, sys);
    // if it's still there, nuke it
    if (other.inUse && !other.freePending) sys.free(other);
    return;
  }
  if (self.dmg && !(sys.timeSeconds < self.touch_debounce_time)) {
    self.touch_debounce_time = sys.timeSeconds + 0.1;
    crush(other, self, self.dmg, sys);
  }
  // [Paril-KEX] don't allow wait -1 doors to return
  if (self.spawnflags & SPAWNFLAG_DOOR_CRUSHER || self.wait === -1) return;
  // a door with a negative wait would never come back if blocked
  if ((mi.wait ?? 0) >= 0) {
    if (mi.state === STATE_DOWN) {
      for (let ent = self.teammaster; ent; ent = ent.teamchain) doorGoUp(ent, ent.activator, sys);
    } else {
      for (let ent = self.teammaster; ent; ent = ent.teamchain) doorGoDown(ent, sys);
    }
  }
}

function crush(targ: Entity, door: Entity, damage: number, sys: EntitySystem): void {
  if (!targ.takedamage) return;
  T_Damage(
    targ as unknown as Damageable,
    door as unknown as Damageable,
    door as unknown as Damageable,
    ZERO,
    targ.origin,
    ZERO,
    damage,
    1,
    DamageFlags.NONE,
    DamageMod.CRUSH,
    sys.timeSeconds,
    sys.multicast.bind(sys),
  );
}

function doorKilled(self: Entity, attacker: Entity | null, sys: EntitySystem): void {
  for (let ent = self.teammaster; ent; ent = ent.teamchain) {
    ent.health = ent.max_health;
    ent.takedamage = false;
  }
  if (self.teammaster) doorUse(self.teammaster, attacker, attacker, sys);
}

function doorTouch(self: Entity, other: Entity | null, sys: EntitySystem): void {
  if (!other?.client) return;
  if (sys.timeSeconds < self.touch_debounce_time) return;
  self.touch_debounce_time = sys.timeSeconds + 5;
  sys.engine.centerprintf?.(other, self.message ?? "");
  sys.sound(other, 0, 'misc/talk1.wav', 1, 1, 0);
}

const size = (ent: Entity): Vec3 => ({ x: ent.maxs.x - ent.mins.x, y: ent.maxs.y - ent.mins.y, z: ent.maxs.z - ent.mins.z });

export const SP_func_door: SpawnFunction = (ent, context) => {
  const sys = context.entities;
  const keys = context.keyValues ?? {};
  if (ent.sounds !== 1) setMoveinfoSounds(ent, keys, 'doors/dr1_strt.wav', 'doors/dr1_mid.wav', 'doors/dr1_end.wav');
  else setMoveinfoSounds(ent, keys);

  ent.movedir = setMovedir(ent.angles);
  ent.angles = { ...ZERO }; // G_SetMovedir clears the angles
  ent.movetype = MoveType.Push;
  ent.solid = Solid.Bsp;
  ent.svflags |= ServerFlags.Door;
  if (ent.model) sys.setModel(ent, ent.model);

  const mi = moveinfo(ent);
  mi.blocked = (self, other) => doorBlocked(self, other, sys);
  ent.use = (self, other, activator) => doorUse(self, other, activator ?? null, sys);

  if (!ent.speed) ent.speed = 100;
  if (sys.deathmatch) ent.speed *= 2;
  if (!ent.accel) ent.accel = ent.speed;
  if (!ent.decel) ent.decel = ent.speed;
  if (!ent.wait) ent.wait = 3;
  const lip = keys.lip !== undefined && Number(keys.lip) ? Number(keys.lip) : 8;
  if (!ent.dmg) ent.dmg = 2;

  // the second position
  ent.pos1 = { ...ent.origin };
  const s = size(ent);
  mi.distance = Math.abs(ent.movedir.x) * s.x + Math.abs(ent.movedir.y) * s.y + Math.abs(ent.movedir.z) * s.z - lip;
  ent.pos2 = add(ent.pos1, scale(ent.movedir, mi.distance));

  // if it starts open, switch the positions
  if (ent.spawnflags & SPAWNFLAG_DOOR_START_OPEN) {
    ent.origin = { ...ent.pos2 };
    ent.pos2 = ent.pos1;
    ent.pos1 = { ...ent.origin };
  }

  mi.state = STATE_BOTTOM;

  if (ent.health) {
    ent.takedamage = true;
    ent.die = (self, _inflictor, attacker) => doorKilled(self, attacker ?? null, sys);
    ent.max_health = ent.health;
  } else if (ent.targetname) {
    if (ent.message) ent.touch = (self, other) => doorTouch(self, other, sys);
    ent.flags |= EntityFlags.Locked;
  }

  mi.speed = ent.speed;
  mi.accel = ent.accel;
  mi.decel = ent.decel;
  mi.wait = ent.wait;
  mi.start_origin = { ...ent.pos1 };
  mi.start_angles = { ...ent.angles };
  mi.end_origin = { ...ent.pos2 };
  mi.end_angles = { ...ent.angles };

  if (ent.spawnflags & SPAWNFLAG_DOOR_ANIMATED) ent.effects |= EntityEffects.AnimAll;
  if (ent.spawnflags & SPAWNFLAG_DOOR_ANIMATED_FAST) ent.effects |= EntityEffects.AnimAllFast;

  // to simplify logic elsewhere, make non-teamed doors into a team of one
  if (!ent.team) ent.teammaster = ent;

  sys.linkentity(ent);

  ent.nextthink = sys.timeSeconds + (sys.frameTimeSeconds || 0.025);
  if (ent.spawnflags & SPAWNFLAG_DOOR_START_OPEN) {
    // Think_DoorActivateAreaPortal: area portals are visibility only here.
    ent.think = (self) => (self.health || self.targetname ? calcMoveSpeed(self) : spawnDoorTrigger(self, sys));
  } else if (ent.health || ent.targetname) {
    ent.think = (self) => calcMoveSpeed(self);
  } else {
    ent.think = (self) => spawnDoorTrigger(self, sys);
  }
};

// ============================================================================
// func_button
// ============================================================================

function buttonDone(self: Entity): void {
  moveinfo(self).state = STATE_BOTTOM;
  self.effects &= ~EntityEffects.Anim23;
  self.effects |= EntityEffects.Anim01;
}

function buttonReturn(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  mi.state = STATE_DOWN;
  moveCalc(self, mi.start_origin!, buttonDone, sys);
  if (self.health) self.takedamage = true;
}

function buttonWait(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  mi.state = STATE_TOP;
  self.effects &= ~EntityEffects.Anim01;
  self.effects |= EntityEffects.Anim23;
  sys.useTargets(self, self.activator);
  if ((mi.wait ?? 0) >= 0) {
    self.nextthink = sys.timeSeconds + (mi.wait ?? 0);
    self.think = (e) => buttonReturn(e, sys);
  }
}

export function buttonFire(self: Entity, sys: EntitySystem): void {
  const mi = moveinfo(self);
  if (mi.state === STATE_UP || mi.state === STATE_TOP) return;
  mi.state = STATE_UP;
  const start = sounds(self).start;
  if (start && !(self.flags & EntityFlags.TeamSlave)) sys.sound(self, MOVER_CHANNEL, start, 1, ATTN_STATIC, 0);
  moveCalc(self, mi.end_origin!, (e) => buttonWait(e, sys), sys);
}

export const SP_func_button: SpawnFunction = (ent, context) => {
  const sys = context.entities;
  const keys = context.keyValues ?? {};
  ent.movedir = setMovedir(ent.angles);
  ent.angles = { ...ZERO }; // G_SetMovedir clears the angles
  ent.movetype = MoveType.Stop;
  ent.solid = Solid.Bsp;
  if (ent.model) sys.setModel(ent, ent.model);

  if (ent.sounds !== 1) setMoveinfoSounds(ent, keys, 'switches/butn2.wav');
  else setMoveinfoSounds(ent, keys);

  if (!ent.speed) ent.speed = 40;
  if (!ent.accel) ent.accel = ent.speed;
  if (!ent.decel) ent.decel = ent.speed;
  if (!ent.wait) ent.wait = 3;
  const lip = keys.lip !== undefined && Number(keys.lip) ? Number(keys.lip) : 4;

  ent.pos1 = { ...ent.origin };
  const s = size(ent);
  const dist = Math.abs(ent.movedir.x) * s.x + Math.abs(ent.movedir.y) * s.y + Math.abs(ent.movedir.z) * s.z - lip;
  ent.pos2 = add(ent.pos1, scale(ent.movedir, dist));

  ent.use = (self, _other, activator) => {
    self.activator = activator ?? null;
    buttonFire(self, sys);
  };
  ent.effects |= EntityEffects.Anim01;

  if (ent.health) {
    ent.max_health = ent.health;
    ent.die = (self, _inflictor, attacker) => {
      self.activator = attacker ?? null;
      self.health = self.max_health;
      self.takedamage = false;
      buttonFire(self, sys);
    };
    ent.takedamage = true;
  } else if (!ent.targetname) {
    ent.touch = (self, other) => {
      if (!other?.client || other.health <= 0) return;
      self.activator = other;
      buttonFire(self, sys);
    };
  }

  const mi = moveinfo(ent);
  mi.state = STATE_BOTTOM;
  mi.speed = ent.speed;
  mi.accel = ent.accel;
  mi.decel = ent.decel;
  mi.wait = ent.wait;
  mi.start_origin = { ...ent.pos1 };
  mi.start_angles = { ...ent.angles };
  mi.end_origin = { ...ent.pos2 };
  mi.end_angles = { ...ent.angles };

  sys.linkentity(ent);
};

export function registerDoorSpawns(registry: SpawnRegistry): void {
  registry.register('func_door', SP_func_door);
  registry.register('func_button', SP_func_button);
}
