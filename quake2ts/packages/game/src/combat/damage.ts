import { addVec3, closestPointToBox, lengthVec3, normalizeVec3, scaleVec3, subtractVec3, type Vec3 } from '@quake2ts/shared';
import { applyPowerArmor, applyRegularArmor, type PowerArmorState, type RegularArmorState } from './armor.js';
import { DamageFlags, hasAnyDamageFlag } from './damageFlags.js';
import { DamageMod } from './damageMods.js';
import type { Entity } from '../entities/entity.js';
import { ServerCommand, TempEntity, ZERO_VEC3 } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { throwGibs } from '../entities/gibs.js';

export interface DamageableCallbacks {
  pain?: (self: Damageable, attacker: Damageable | null, knockback: number, take: number, mod: DamageMod) => void;
  die?: (self: Damageable, inflictor: Damageable | null, attacker: Damageable | null, take: number, point: Vec3, mod: DamageMod) => void;
}

export interface Damageable extends DamageableCallbacks {
  readonly id?: string;
  takedamage: boolean;
  health: number;
  readonly maxHealth?: number;
  readonly mass?: number;
  velocity: Vec3;
  readonly origin: Vec3;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
  readonly flags?: EntityDamageFlags;
  readonly regularArmor?: RegularArmorState;
  readonly powerArmor?: PowerArmorState;
}

export enum EntityDamageFlags {
  GODMODE = 1 << 0,
  IMMORTAL = 1 << 1,
  NO_KNOCKBACK = 1 << 2,
  NO_DAMAGE_EFFECTS = 1 << 3,
}

export interface DamageApplicationResult {
  readonly take: number;
  readonly psave: number;
  readonly asave: number;
  readonly knocked: Vec3;
  readonly killed: boolean;
  readonly remainingArmor?: number;
  readonly remainingCells?: number;
}

export interface DamageSource {
  readonly origin: Vec3;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
}

export interface RadiusDamageHit {
  readonly target: Damageable;
  readonly result: DamageApplicationResult | null;
  readonly appliedDamage: number;
}

export interface RadiusDamageOptions {
  readonly canDamage?: (ent: Damageable, inflictor: DamageSource) => boolean;
}

function getDamageModifier(attacker: Damageable | null, time: number): number {
  // Based on rerelease/p_weapon.cpp:35-57 P_DamageModifier
  if (!attacker) {
    return 1;
  }

  const client = (attacker as Entity).client;
  if (!client) {
    return 1;
  }

  let modifier = 1;

  if (client.quad_time && client.quad_time > time) {
    modifier *= 4;
  }

  if (client.double_time && client.double_time > time) {
    modifier *= 2;
  }

  return modifier;
}

function applyKnockback(
  targ: Damageable,
  attacker: Damageable | null,
  dir: Vec3,
  knockback: number,
  dflags: number,
): Vec3 {
  const hasNoKnockback =
    hasAnyDamageFlag(dflags, DamageFlags.NO_KNOCKBACK) || ((targ.flags ?? 0) & EntityDamageFlags.NO_KNOCKBACK) !== 0;
  if (hasNoKnockback || knockback === 0) {
    return { x: 0, y: 0, z: 0 };
  }

  const mass = Math.max(50, targ.mass ?? 200);
  const normalized = normalizeVec3(dir);
  const scale = attacker === targ ? 1600 : 500;
  const delta = scaleVec3(normalized, (scale * knockback) / mass);
  targ.velocity = addVec3(targ.velocity, delta);
  return delta;
}

function applyProtection(
  targ: Damageable,
  point: Vec3,
  normal: Vec3,
  damage: number,
  dflags: number,
): [number, number, number, number?, number?] {
  let take = damage;
  let psave = 0;
  let asave = 0;
  let remainingCells: number | undefined;
  let remainingArmor: number | undefined;

  if (targ.powerArmor) {
    const result = applyPowerArmor(damage, dflags, point, normal, targ.powerArmor);
    psave = result.saved;
    remainingCells = result.remainingCells;
    take -= psave;
  }

  if (targ.regularArmor) {
    const result = applyRegularArmor(take, dflags, targ.regularArmor);
    asave = result.saved;
    remainingArmor = result.remainingArmor;
    take -= asave;
  }

  return [Math.max(0, take), psave, asave, remainingCells, remainingArmor];
}

function targetCenter(ent: DamageSource | Damageable): Vec3 {
  if (ent.mins && ent.maxs) {
    return {
      x: ent.origin.x + (ent.mins.x + ent.maxs.x) * 0.5,
      y: ent.origin.y + (ent.mins.y + ent.maxs.y) * 0.5,
      z: ent.origin.z + (ent.mins.z + ent.maxs.z) * 0.5,
    };
  }
  return ent.origin;
}

export function T_Damage(
  targ: Damageable,
  inflictor: Damageable | null,
  attacker: Damageable | null,
  dir: Vec3,
  point: Vec3,
  normal: Vec3,
  damage: number,
  knockback: number,
  dflags: number,
  mod: DamageMod,
  time: number,
  multicast?: (origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]) => void
): DamageApplicationResult | null {
  if (!targ.takedamage) {
    return null;
  }

  const modifier = getDamageModifier(attacker, time);
  const modifiedDamage = damage * modifier;
  const modifiedKnockback = knockback * modifier;

  const protectedByGod =
    !hasAnyDamageFlag(dflags, DamageFlags.NO_PROTECTION) && ((targ.flags ?? 0) & EntityDamageFlags.GODMODE) !== 0 && modifiedDamage > 0;

  if (protectedByGod) {
    return {
      take: 0,
      psave: 0,
      asave: modifiedDamage,
      knocked: { x: 0, y: 0, z: 0 },
      killed: false,
    };
  }

  const knocked = applyKnockback(targ, attacker, dir, modifiedKnockback, dflags);
  let [take, psave, asave, remainingCells, remainingArmor] = applyProtection(targ, point, normal, modifiedDamage, dflags);

  // Freeze Shatter Override
  if ((targ as any).monsterinfo && (targ as any).monsterinfo.freeze_time > time && modifiedDamage > 0) {
       // If frozen, any damage destroys it.
       take = targ.health + 100;
       psave = 0;
       asave = 0;

       // Visual effect?
       // We can trigger glass shatter sound/particles here via multicast if we had sys?
       // We will rely on die() to handle visual gibs.
  }

  if (targ.powerArmor && remainingCells !== undefined) {
    (targ.powerArmor as PowerArmorState).cellCount = remainingCells;
  }
  if (targ.regularArmor) {
    (targ.regularArmor as RegularArmorState).armorCount = remainingArmor ?? targ.regularArmor.armorCount;
  }

  let actualTake = take;

  if (actualTake > 0) {
    targ.health -= actualTake;

    // Spawn blood/sparks if multicast is available and we did damage
    if (multicast && !hasAnyDamageFlag(dflags, DamageFlags.NO_DAMAGE_EFFECTS)) {
        if ((targ as any).classname === 'player' || (targ as any).monsterinfo) {
             // Bleed
             // Quake 2: Check for MASK_SOLID vs MASK_SHOT
             // Here we assume if it has health and is player/monster, it bleeds.
             // gi.WriteByte (svc_temp_entity);
             // gi.WriteByte (TE_BLOOD);
             // gi.WritePosition (point);
             // gi.WriteDir (normal);
             // gi.multicast (point, MULTICAST_PVS);
             multicast(point, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.BLOOD, point, normal);
        } else {
             // Sparks? If Bullet?
             // Only for walls usually, but entities can spark too (like robots).
             // Standard Quake 2 T_Damage doesn't spawn sparks for entities unless specific material.
        }
    }
  }

  const killed = targ.health <= 0;
  if (killed) {
    if (targ.flags && (targ.flags & EntityDamageFlags.IMMORTAL)) {
      targ.health = Math.max(1, targ.health);
    } else if (targ.die) {
      targ.die(targ, inflictor, attacker, actualTake, point, mod);
    }
  } else if (actualTake > 0 && targ.pain) {
    targ.pain(targ, attacker, knockback, actualTake, mod);
  }

  return { take: actualTake, psave, asave, knocked, killed, remainingCells, remainingArmor };
}

export function T_RadiusDamage(
  entities: readonly Damageable[],
  inflictor: DamageSource,
  attacker: Damageable | null,
  damage: number,
  ignore: Damageable | null,
  radius: number,
  dflags: number,
  mod: DamageMod,
  time: number,
  options: RadiusDamageOptions = {},
  multicast?: (origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]) => void
): RadiusDamageHit[] {
  const hits: RadiusDamageHit[] = [];
  const inflictorCenter = targetCenter(inflictor);
  const canDamage = options.canDamage ?? (() => true);

  for (const ent of entities) {
    if (ent === ignore || !ent.takedamage || !canDamage(ent, inflictor)) {
      continue;
    }

    const entCenter = ent.mins && ent.maxs
      ? closestPointToBox(inflictorCenter, addVec3(ent.origin, ent.mins), addVec3(ent.origin, ent.maxs))
      : targetCenter(ent);
    const toTarget = subtractVec3(inflictorCenter, entCenter);
    const distance = lengthVec3(toTarget);
    if (radius > 0 && distance > radius) {
      continue;
    }

    const points = damage - 0.5 * distance;
    if (points <= 0) {
      continue;
    }

    let adjustedDamage = points;

    // In Quake 2, T_RadiusDamage halves 'points' (which is both damage and knockback)
    // for self-damage. g_combat.c:
    // if (ent == attacker) points = points * 0.5;
    if (ent === attacker) {
      adjustedDamage = points * 0.5;
    }

    // Since points was halved, both damage and knockback are halved.
    const adjustedKnockback = adjustedDamage;

    const dir = normalizeVec3(subtractVec3(ent.origin, inflictorCenter));

    const result = T_Damage(ent, inflictor as Damageable | null, attacker, dir, entCenter, dir, adjustedDamage, adjustedKnockback, dflags | DamageFlags.RADIUS, mod, time, multicast);
    hits.push({ target: ent, result, appliedDamage: adjustedDamage });
  }

  return hits;
}
