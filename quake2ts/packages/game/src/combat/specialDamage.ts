import {
  CONTENTS_LAVA,
  CONTENTS_SLIME,
  WaterLevel,
  addVec3,
  boxesIntersect,
  type Bounds3,
  type Vec3,
} from '@quake2ts/shared';

import { DamageFlags } from './damageFlags.js';
import { DamageMod } from './damageMods.js';
import { T_Damage, type Damageable, type DamageApplicationResult } from './damage.js';
import { MoveType, Solid } from '../entities/entity.js';

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export enum EnvironmentalFlags {
  IN_WATER = 1 << 0,
  IMMUNE_LAVA = 1 << 1,
  IMMUNE_SLIME = 1 << 2,
}

export interface EnvironmentalDamageTarget extends Damageable {
  waterlevel: WaterLevel;
  watertype: number;
  airFinished: number;
  painDebounceTime: number;
  damageDebounceTime: number;
  environmentFlags?: EnvironmentalFlags;
}

export interface EnvironmentalDamageEvent {
  readonly mod: DamageMod;
  readonly amount: number;
  readonly result: DamageApplicationResult | null;
}

export interface EnvironmentalDamageResult {
  readonly events: EnvironmentalDamageEvent[];
  readonly enteredWater: boolean;
  readonly leftWater: boolean;
}

function applyDamageEvent(
  target: EnvironmentalDamageTarget,
  amount: number,
  mod: DamageMod,
  time: number,
): DamageApplicationResult | null {
  return T_Damage(target, null, null, ZERO, target.origin, ZERO, amount, 0, DamageFlags.NO_ARMOR, mod, time);
}

export function applyEnvironmentalDamage(
  target: EnvironmentalDamageTarget,
  nowMs: number,
): EnvironmentalDamageResult {
  const events: EnvironmentalDamageEvent[] = [];
  let flags = target.environmentFlags ?? 0;
  let enteredWater = false;
  let leftWater = false;

  if (target.waterlevel !== WaterLevel.None) {
      // In water
      if ((flags & EnvironmentalFlags.IN_WATER) === 0) {
          flags |= EnvironmentalFlags.IN_WATER;
          enteredWater = true;
          target.damageDebounceTime = 0;
      }

      // Check for drowning (only if head is under water)
      if (target.waterlevel === WaterLevel.Under) { // WaterLevel 3
          // If airFinished is past, we are drowning.
          if (target.airFinished < nowMs) {
             if (target.painDebounceTime <= nowMs) {
                const elapsedSeconds = Math.floor((nowMs - target.airFinished) / 1000);
                const amount = Math.min(15, 2 + 2 * elapsedSeconds);
                const result = applyDamageEvent(target, amount, DamageMod.WATER, nowMs / 1000);
                target.painDebounceTime = nowMs + 1000;
                events.push({ mod: DamageMod.WATER, amount, result });
             }
          }
      } else {
          // Reset air if head is not under water
          target.airFinished = nowMs + 9000;
      }

      // Check lava/slime damage
      if (target.damageDebounceTime <= nowMs) {
        if (target.watertype & CONTENTS_LAVA) {
          // Lava: 1/3 damage with immunity, full otherwise.
          const isImmune = (flags & EnvironmentalFlags.IMMUNE_LAVA) !== 0;
          const damageMult = isImmune ? 1 : 3;
          const amount = damageMult * target.waterlevel;

          const result = applyDamageEvent(target, amount, DamageMod.LAVA, nowMs / 1000);
          target.damageDebounceTime = nowMs + 100; // 10Hz
          events.push({ mod: DamageMod.LAVA, amount, result });
        }

        if (target.watertype & CONTENTS_SLIME) {
          // Slime: No damage if immune.
          const isImmune = (flags & EnvironmentalFlags.IMMUNE_SLIME) !== 0;
          if (!isImmune) {
             const amount = 1 * target.waterlevel;
             const result = applyDamageEvent(target, amount, DamageMod.SLIME, nowMs / 1000);
             target.damageDebounceTime = nowMs + 100; // 10Hz
             events.push({ mod: DamageMod.SLIME, amount, result });
          }
        }
      }
  } else {
      // Not in water
      if ((flags & EnvironmentalFlags.IN_WATER) !== 0) {
          flags &= ~EnvironmentalFlags.IN_WATER;
          leftWater = true;
      }

      // Reset air when out of water
      target.airFinished = nowMs + 9000;
  }

  target.environmentFlags = flags;

  return { events, enteredWater, leftWater };
}

export type FallingEvent = 'footstep' | 'fallshort' | 'fall' | 'fallfar' | null;

export interface FallingDamageContext {
  readonly impactDelta: number;
  readonly waterLevel: WaterLevel;
  readonly onLadder?: boolean;
  readonly isDead?: boolean;
  readonly isPlayerModel?: boolean;
  readonly isNoClip?: boolean;
  readonly grappleBlockingFallDamage?: boolean;
  readonly clampFreeFall?: boolean;
  readonly skipDamage?: boolean;
}

export interface FallingDamageResult {
  readonly damage: number;
  readonly event: FallingEvent;
  readonly fallValue: number;
  readonly adjustedDelta: number;
}

export function calculateFallingDamage(context: FallingDamageContext): FallingDamageResult {
  const {
    impactDelta,
    waterLevel,
    onLadder = false,
    isDead = false,
    isPlayerModel = true,
    isNoClip = false,
    grappleBlockingFallDamage = false,
    clampFreeFall = false,
    skipDamage = false,
  } = context;

  if (isDead || !isPlayerModel || isNoClip || grappleBlockingFallDamage || waterLevel === WaterLevel.Under) {
    return { damage: 0, event: null, fallValue: 0, adjustedDelta: 0 };
  }

  let delta = impactDelta * impactDelta * 0.0001;

  if (waterLevel === WaterLevel.Waist) {
    delta *= 0.25;
  } else if (waterLevel === WaterLevel.Feet) {
    delta *= 0.5;
  }

  if (clampFreeFall) {
    delta = Math.min(30, delta);
  }

  if (delta < 1) {
    return { damage: 0, event: null, fallValue: 0, adjustedDelta: delta };
  }

  let event: FallingEvent = null;
  let damage = 0;
  let fallValue = 0;

  if (delta < 15) {
    event = onLadder ? null : 'footstep';
  } else {
    fallValue = Math.min(delta * 0.5, 40);

    if (delta > 30) {
      event = delta >= 55 ? 'fallfar' : 'fall';
      damage = Math.max(1, (delta - 30) * 0.5);
    } else {
      event = 'fallshort';
    }
  }

  if (skipDamage) {
    damage = 0;
  }

  return { damage, event, fallValue, adjustedDelta: delta };
}

export function applyFallingDamage(
  target: Damageable,
  context: FallingDamageContext,
): FallingDamageResult {
  const result = calculateFallingDamage(context);

  if (result.damage > 0 && !context.skipDamage) {
    T_Damage(
      target,
      null,
      null,
      { x: 0, y: 0, z: 1 },
      target.origin,
      ZERO,
      result.damage,
      0,
      DamageFlags.NO_ARMOR,
      DamageMod.FALLING,
      0,
    );
  }

  return result;
}

export interface CrushableTarget extends Damageable {
  readonly isMonster?: boolean;
  readonly isClient?: boolean;
}

export interface CrushDamageOptions {
  readonly baseDamage?: number;
  readonly nonLivingDamage?: number;
  readonly gibDamage?: number;
}

export interface CrushDamageResult {
  readonly amount: number;
  readonly result: DamageApplicationResult | null;
}

export function applyCrushDamage(
  crusher: Damageable,
  target: CrushableTarget,
  options: CrushDamageOptions = {},
): CrushDamageResult {
  const nonLivingDamage = options.nonLivingDamage ?? 100_000;
  const gibDamage = options.gibDamage ?? 100;
  const baseDamage = options.baseDamage ?? (crusher as any).dmg ?? 10;

  const amount = !target.isMonster && !target.isClient ? nonLivingDamage : target.health < 1 ? gibDamage : baseDamage;
  const result = T_Damage(target, crusher, crusher, ZERO, target.origin, ZERO, amount, 1, DamageFlags.NONE, DamageMod.CRUSH, 0);

  return { amount, result };
}

export interface TelefragEntity extends Damageable {
  readonly movetype?: MoveType;
  readonly solid?: Solid;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
}

export interface TelefragTarget extends Damageable {
  readonly inUse?: boolean;
  readonly movetype?: MoveType;
  readonly solid?: Solid;
  readonly mins?: Vec3;
  readonly maxs?: Vec3;
}

export interface TelefragEvent {
  readonly target: TelefragTarget;
  readonly result: DamageApplicationResult | null;
}

export interface TelefragResult {
  readonly events: TelefragEvent[];
  readonly cleared: boolean;
}

export interface TelefragOptions {
  readonly mod?: DamageMod;
}

function absoluteBounds(ent: { readonly origin: Vec3; readonly mins?: Vec3; readonly maxs?: Vec3 }): Bounds3 {
  const mins = ent.mins ?? ZERO;
  const maxs = ent.maxs ?? ZERO;

  return {
    mins: addVec3(ent.origin, mins),
    maxs: addVec3(ent.origin, maxs),
  };
}

export function killBox(
  teleporter: TelefragEntity,
  targets: readonly TelefragTarget[],
  options: TelefragOptions = {},
): TelefragResult {
  if (teleporter.movetype === MoveType.Noclip) {
    return { events: [], cleared: true };
  }

  const mod = options.mod ?? DamageMod.TELEFRAG;
  const teleBounds = absoluteBounds(teleporter);
  const events: TelefragEvent[] = [];
  let cleared = true;

  for (const target of targets) {
    if (target === teleporter || target.inUse === false) {
      continue;
    }

    const solidity = target.solid ?? Solid.Not;
    if (!target.takedamage || solidity === Solid.Not || solidity === Solid.Trigger || solidity === Solid.Bsp) {
      continue;
    }

    if (!boxesIntersect(teleBounds, absoluteBounds(target))) {
      continue;
    }

    const result = T_Damage(target, teleporter, teleporter, ZERO, target.origin, ZERO, 100_000, 0, DamageFlags.NO_PROTECTION, mod, 0);
    events.push({ target, result });

    if (!result || !result.killed || target.health > 0) {
      cleared = false;
    }
  }

  return { events, cleared };
}
