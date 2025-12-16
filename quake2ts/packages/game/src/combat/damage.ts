import { addVec3, closestPointToBox, lengthVec3, normalizeVec3, scaleVec3, subtractVec3, type Vec3 } from '@quake2ts/shared';
import { applyPowerArmor, applyRegularArmor, type PowerArmorState, type RegularArmorState } from './armor.js';
import { DamageFlags, EntityDamageFlags, hasAnyDamageFlag } from './damageFlags.js';
import { DamageMod } from './damageMods.js';
import type { Entity } from '../entities/entity.js';
import type { EntitySystem } from '../entities/system.js';
import { ServerCommand, TempEntity, ZERO_VEC3 } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { throwGibs } from '../entities/gibs.js';

// We need access to GameExports or EntitySystem to trigger hooks.
// Since T_Damage is a standalone function, we might need to rely on the entity having a reference
// to the game or we assume we can access a global or pass context.
// However, 'ent' usually doesn't have a direct 'game' reference unless we added it.
// EntitySystem has it.
//
// In this codebase, EntitySystem has a '_game' property.
// And 'ent' is managed by EntitySystem.
// But we don't have a direct link from Entity back to EntitySystem on the interface.
//
// Wait, 'Entity' interface is just data.
// But T_Damage logic already uses 'multicast' passed in or imported?
// The current T_Damage signature accepts 'multicast'.
// We can add 'hooks' to the options or arguments, but that changes the signature widely.
//
// Alternatively, we can use the fact that 'ent' is an object and if we can find the EntitySystem that owns it...
// We don't have that.
//
// However, we can check if 'ent' has a 'hooks' property if we injected it? No.
//
// Let's look at how we can trigger the hook.
// T_Damage is called from GameExports.damage, weapon firing, etc.
// Most call sites have access to 'game' or 'entities'.
//
// Ideally T_Damage should accept a context object including hooks.
// But refactoring T_Damage signature everywhere is risky and large.
//
// Let's see if we can use the 'multicast' argument? No.
//
// Wait, T_Damage calls 'targ.die' and 'targ.pain'.
// 'targ.die' is often 'player_die' which takes 'entities' as argument.
// So we can trigger 'onPlayerDeath' inside 'player_die' (which we already did).
//
// What about 'onDamage'?
// We need to trigger it before damage is applied or after?
// "Called when an entity takes damage."
//
// If we want to support modifying damage, it should be before.
//
// If we cannot easily access hooks in T_Damage, maybe we can export a 'setHooks' or 'setGame' for the module?
// Or we can rely on a singleton if available? No singletons.
//
// Let's check 'EntitySystem'. It has 'scriptHooks'.
// Can we pass 'EntitySystem' to T_Damage?
// The current signature:
// export function T_Damage(
//   targ: Damageable,
//   ...
//   multicast?: ...
//   options?: DamageOptions
// )
//
// 'Damageable' is an interface implemented by Entity.
//
// If we update 'DamageOptions' to include 'hooks' or 'entitySystem'?
//
// Or better: In 'packages/game/src/index.ts', we export 'game'.
// But we are inside 'packages/game/src/combat/damage.ts'.
// Circular dependency if we import 'game' instance (which doesn't exist statically).
//
// Let's look at call sites.
// `game.damage` calls `T_Damage`.
// `fireShotgun` calls `fireLead` which calls `fireBullet` ...
//
// The cleanest way is to add `entitySystem` or `hooks` to `T_Damage` arguments.
// `T_Damage` is widely used.
//
// Maybe we can add it to `DamageOptions`?
// `options?: DamageOptions & { hooks?: ScriptHookRegistry }`
//
// And then in `GameExports.damage`, we pass it.
// But what about internal calls like `fireBullet`?
// They typically don't pass options or pass empty options.
//
// If we want 'onDamage' to work globally, we need it in T_Damage.
//
// Let's try to find a way to access the registry.
//
// Actually, `EntitySystem` is where we added `scriptHooks`.
// Does `Entity` have a hidden link to `EntitySystem`?
// No, it's a POJO.
//
// However, `targ.die` is a callback.
//
// If we strictly follow the plan "pass Hooks to EntitySystem" (done),
// "Implement Remaining Hook Triggers":
// - Entity Spawn (done in EntitySystem)
// - Entity Remove (done in EntitySystem)
// - Pickup (done in handleItemPickup, accessed via game)
//
// - Damage: "Trigger onDamage in T_Damage".
//
// This is the hard one.
//
// If I change T_Damage signature, I have to update all callers.
//
// Let's see if there is another way.
// Maybe `targ` has a `_system` reference? No.
//
// What if we add `hooks?: ScriptHookRegistry` to `DamageOptions`?
// And we update `T_Damage` to check `options?.hooks`.
// Then we need to update callers to pass it.
//
// Most callers are in `weapons`. Weapons usually have access to `game` or `entities`.
//
// Let's try to update `T_Damage` to take an optional `hooks` in `DamageOptions`.
// And in `GameExports`, we pass it.
// And in `fire_...` functions, we need to pass it.
//
// This seems correct but laborious.
//
// Alternative: `T_Damage` is imported from `damage.ts`.
// Can we wrap `T_Damage` in `GameExports` and use that?
// But existing code imports `T_Damage` directly from `combat/index.ts`.
//
// Wait, `GameExports` exposes `damage(amount)` which calls `T_Damage`.
// But weapons import `T_Damage` directly.
//
// If I modify `T_Damage` signature, TypeScript will tell me all places to fix.
//
// Let's Modify `DamageOptions`.

export interface DamageOptions {
  /** If true, check if attacker and target are on same team and apply rules. */
  checkFriendlyFire?: boolean;
  /** If true (and checkFriendlyFire is on), damage is 0 for teammates. */
  noFriendlyFire?: boolean;
  /** Hooks registry to trigger onDamage event */
  hooks?: any; // Avoiding strict type circular dependency for now, or import ScriptHookRegistry type
}

import type { ScriptHookRegistry } from '../scripting/hooks.js';

function onSameTeam(ent1: Entity, ent2: Entity): boolean {
  if (!ent1.client || !ent2.client) {
    return false;
  }
  // TODO: Add team check when teams are implemented (e.g., CTF).
  // For now, in Coop, all players are on the same team.
  return true;
}

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

export { EntityDamageFlags };

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

export interface RadiusDamageOptions extends DamageOptions {
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
  multicast?: (origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]) => void,
  options?: DamageOptions,
  sys?: EntitySystem
): DamageApplicationResult | null {
  // Trigger hook if present
  if (options?.hooks) {
     const hookRegistry = options.hooks as ScriptHookRegistry;
     // We cast targ, inflictor, attacker to Entity because ScriptHooks expects Entity.
     // T_Damage uses Damageable which is a subset/interface of Entity.
     // In practice they are Entities.
     hookRegistry.onDamage(targ as Entity, inflictor as Entity | null, attacker as Entity | null, damage, dflags, mod);
  }

  if (!targ.takedamage) {
    return null;
  }

  // Friendly fire check
  let currentMod = mod;
  let currentDamage = damage;
  if (options?.checkFriendlyFire && attacker && targ !== attacker && (targ as any).client && (attacker as any).client) {
    if (onSameTeam(targ as Entity, attacker as Entity)) {
      if (options.noFriendlyFire) {
        currentDamage = 0;
      } else {
        currentMod = DamageMod.FRIENDLY_FIRE;
      }
    }
  }

  // Check for Environment Suit protection
  const client = (targ as Entity).client;
  if (client && client.enviro_time && client.enviro_time > time) {
      if (mod === DamageMod.SLIME || mod === DamageMod.LAVA) {
          return {
              take: 0,
              psave: 0,
              asave: 0,
              knocked: { x: 0, y: 0, z: 0 },
              killed: false,
          };
      }
  }

  const modifier = getDamageModifier(attacker, time);
  const modifiedDamage = currentDamage * modifier;
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

    // Visual effect for power armor
    if (psave > 0 && multicast) {
        if (targ.powerArmor.type === 'screen') {
            multicast(point, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.SCREEN_SPARKS, point, normal);
            // TE_SCREEN_SPARKS plays misc/power2.wav on client
        } else if (targ.powerArmor.type === 'shield') {
            multicast(point, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.SHIELD_SPARKS, point, normal);
             // TE_SHIELD_SPARKS plays misc/power2.wav on client
        }
    }
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
      targ.die(targ, inflictor, attacker, actualTake, point, currentMod);
    }
  } else if (actualTake > 0 && targ.pain) {
    targ.pain(targ, attacker, knockback, actualTake, currentMod);
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

    // Pass hooks from options if present
    const damageOptions: DamageOptions = {
        ...options,
        hooks: options.hooks
    };

    const result = T_Damage(ent, inflictor as Damageable | null, attacker, dir, entCenter, dir, adjustedDamage, adjustedKnockback, dflags | DamageFlags.RADIUS, mod, time, multicast, damageOptions);
    hits.push({ target: ent, result, appliedDamage: adjustedDamage });
  }

  return hits;
}
