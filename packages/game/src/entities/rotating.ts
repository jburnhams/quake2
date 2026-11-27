/**
 * func_rotating, ported from the rerelease g_func.cpp.
 *
 * It turns about its origin brush: yaw by default (movedir is an angles vector, so Z_AXIS is
 * movedir[1]), roll with X_AXIS and pitch with Y_AXIS, backwards with REVERSE. Using it starts or
 * stops it (firing its targets either way); ACCEL ramps the speed by "accel" a frame on the way
 * up and "decel" on the way down. Blocked, it hurts what it pushes by "dmg" (2 unless given) at
 * most ten times a second; TOUCH_PAIN hurts what touches it while it turns.
 */
import type { Vec3 } from '@quake2ts/shared';
import { T_Damage, type Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { Entity, MoveType, Solid } from './entity.js';
import { EntityEffects } from './enums.js';
import { moveinfo } from './movers.js';
import type { SpawnFunction } from './spawn.js';
import type { EntitySystem } from './system.js';

export const SPAWNFLAG_ROTATING_START_ON = 1;
export const SPAWNFLAG_ROTATING_REVERSE = 2;
export const SPAWNFLAG_ROTATING_X_AXIS = 4;
export const SPAWNFLAG_ROTATING_Y_AXIS = 8;
export const SPAWNFLAG_ROTATING_TOUCH_PAIN = 16;
export const SPAWNFLAG_ROTATING_STOP = 32;
export const SPAWNFLAG_ROTATING_ANIMATED = 64;
export const SPAWNFLAG_ROTATING_ANIMATED_FAST = 128;
export const SPAWNFLAG_ROTATING_ACCEL = 0x00010000;

const ATTN_NONE = 0;
const ATTN_STATIC = 3;
const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
const scale = (v: Vec3, s: number): Vec3 => ({ x: v.x * s, y: v.y * s, z: v.z * s });
const length = (v: Vec3) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const turning = (v: Vec3) => v.x !== 0 || v.y !== 0 || v.z !== 0;

function crush(targ: Entity, self: Entity, sys: EntitySystem): void {
  if (!targ.takedamage) return;
  T_Damage(
    targ as unknown as Damageable,
    self as unknown as Damageable,
    self as unknown as Damageable,
    ZERO,
    targ.origin,
    ZERO,
    self.dmg,
    1,
    DamageFlags.NONE,
    DamageMod.CRUSH,
    sys.timeSeconds,
    sys.multicast.bind(sys),
  );
}

/** rotating_accel */
function rotatingAccel(self: Entity, sys: EntitySystem): void {
  let current = length(self.avelocity);
  if (current >= self.speed - self.accel) {
    // done
    self.avelocity = scale(self.movedir, self.speed);
    sys.useTargets(self, self);
  } else {
    current += self.accel;
    self.avelocity = scale(self.movedir, current);
    self.think = (e) => rotatingAccel(e, sys);
    self.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
  }
}

/** rotating_decel */
function rotatingDecel(self: Entity, sys: EntitySystem): void {
  let current = length(self.avelocity);
  if (current <= self.decel) {
    // done
    self.avelocity = { ...ZERO };
    sys.useTargets(self, self);
    self.touch = undefined;
  } else {
    current -= self.decel;
    self.avelocity = scale(self.movedir, current);
    self.think = (e) => rotatingDecel(e, sys);
    self.nextthink = sys.timeSeconds + sys.frameTimeSeconds;
  }
}

/** rotating_blocked */
function rotatingBlocked(self: Entity, other: Entity, sys: EntitySystem): void {
  if (!self.dmg) return;
  if (sys.timeSeconds < self.touch_debounce_time) return;
  self.touch_debounce_time = sys.timeSeconds + 0.1;
  crush(other, self, sys);
}

/** rotating_touch */
function rotatingTouch(self: Entity, other: Entity | null, sys: EntitySystem): void {
  if (other && turning(self.avelocity)) crush(other, self, sys);
}

/** rotating_use */
function rotatingUse(self: Entity, sys: EntitySystem): void {
  if (turning(self.avelocity)) {
    self.sound = 0;
    // PGM
    if (self.spawnflags & SPAWNFLAG_ROTATING_ACCEL) {
      rotatingDecel(self, sys); // Decelerate
    } else {
      self.avelocity = { ...ZERO };
      sys.useTargets(self, self);
      self.touch = undefined;
    }
    // PGM
  } else {
    self.sound = moveinfo(self).sound_middle ?? 0;
    // PGM
    if (self.spawnflags & SPAWNFLAG_ROTATING_ACCEL) {
      rotatingAccel(self, sys); // accelerate
    } else {
      self.avelocity = scale(self.movedir, self.speed);
      sys.useTargets(self, self);
    }
    if (self.spawnflags & SPAWNFLAG_ROTATING_TOUCH_PAIN) self.touch = (e, other) => rotatingTouch(e, other, sys);
    // PGM
  }
}

/** SP_func_rotating */
export const SP_func_rotating: SpawnFunction = (ent, context) => {
  const sys = context.entities;
  const st = context.keyValues ?? {};
  ent.solid = Solid.Bsp;
  ent.movetype = ent.spawnflags & SPAWNFLAG_ROTATING_STOP ? MoveType.Stop : MoveType.Push;

  if (st.noise) {
    moveinfo(ent).sound_middle = sys.soundIndex(st.noise);
    // [Paril-KEX] for rhangar1 doors (s.loop_attenuation is not in the port's entity state)
    if (st.attenuation === undefined) ent.attenuation = ATTN_STATIC;
    else if (ent.attenuation === -1) ent.attenuation = ATTN_NONE;
  }

  // set the axis of rotation
  if (ent.spawnflags & SPAWNFLAG_ROTATING_X_AXIS) ent.movedir = { x: 0, y: 0, z: 1 };
  else if (ent.spawnflags & SPAWNFLAG_ROTATING_Y_AXIS) ent.movedir = { x: 1, y: 0, z: 0 };
  else ent.movedir = { x: 0, y: 1, z: 0 }; // Z_AXIS

  // check for reverse rotation
  if (ent.spawnflags & SPAWNFLAG_ROTATING_REVERSE) ent.movedir = scale(ent.movedir, -1);

  if (!ent.speed) ent.speed = 100;
  if (st.dmg === undefined) ent.dmg = 2;

  ent.use = (self) => rotatingUse(self, sys);
  if (ent.dmg) moveinfo(ent).blocked = (self, other) => rotatingBlocked(self, other, sys);

  if (ent.spawnflags & SPAWNFLAG_ROTATING_START_ON) rotatingUse(ent, sys);

  if (ent.spawnflags & SPAWNFLAG_ROTATING_ANIMATED) ent.effects |= EntityEffects.AnimAll;
  if (ent.spawnflags & SPAWNFLAG_ROTATING_ANIMATED_FAST) ent.effects |= EntityEffects.AnimAllFast;

  // PGM
  if (ent.spawnflags & SPAWNFLAG_ROTATING_ACCEL) {
    // Accelerate / Decelerate
    if (!ent.accel) ent.accel = 1;
    else if (ent.accel > ent.speed) ent.accel = ent.speed;
    if (!ent.decel) ent.decel = 1;
    else if (ent.decel > ent.speed) ent.decel = ent.speed;
  }
  // PGM

  if (ent.model) sys.setModel(ent, ent.model);
  sys.linkentity(ent);
};
