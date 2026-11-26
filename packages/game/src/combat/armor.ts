import { angleVectors, type Vec3 } from '@quake2ts/shared';
import { DamageFlags, hasAnyDamageFlag } from './damageFlags.js';

export enum ArmorType {
  BODY = 'body',
  COMBAT = 'combat',
  JACKET = 'jacket',
}

export interface ArmorInfo {
  readonly baseCount: number;
  readonly maxCount: number;
  readonly normalProtection: number;
  readonly energyProtection: number;
}

export const ARMOR_INFO: Record<ArmorType, ArmorInfo> = {
  [ArmorType.JACKET]: {
    baseCount: 25,
    maxCount: 50,
    normalProtection: 0.3,
    energyProtection: 0,
  },
  [ArmorType.COMBAT]: {
    baseCount: 50,
    maxCount: 100,
    normalProtection: 0.6,
    energyProtection: 0.3,
  },
  [ArmorType.BODY]: {
    baseCount: 100,
    maxCount: 200,
    normalProtection: 0.8,
    energyProtection: 0.6,
  },
};

export interface RegularArmorState {
  readonly armorType: ArmorType | null;
  armorCount: number;
}

export interface RegularArmorResult {
  readonly saved: number;
  readonly remainingArmor: number;
}

export function applyRegularArmor(
  damage: number,
  flags: number,
  state: RegularArmorState,
): RegularArmorResult {
  if (
    damage <= 0 ||
    hasAnyDamageFlag(flags, DamageFlags.NO_ARMOR | DamageFlags.NO_REG_ARMOR) ||
    !state.armorType ||
    state.armorCount <= 0
  ) {
    return { saved: 0, remainingArmor: state.armorCount };
  }

  const info = ARMOR_INFO[state.armorType];
  const protection = hasAnyDamageFlag(flags, DamageFlags.ENERGY)
    ? info.energyProtection
    : info.normalProtection;

  let saved = Math.ceil(protection * damage);
  if (saved >= state.armorCount) {
    saved = state.armorCount;
  }

  if (saved <= 0) {
    return { saved: 0, remainingArmor: state.armorCount };
  }

  return { saved, remainingArmor: state.armorCount - saved };
}

export type PowerArmorType = 'screen' | 'shield';

export interface PowerArmorState {
  readonly type: PowerArmorType | null;
  cellCount: number;
  readonly angles: Vec3;
  readonly origin: Vec3;
  readonly health: number;
}

export interface PowerArmorOptions {
  readonly ctfMode?: boolean;
}

export interface PowerArmorResult {
  readonly saved: number;
  readonly remainingCells: number;
}

// Implements CheckPowerArmor from rerelease/g_combat.cpp
export function applyPowerArmor(
  damage: number,
  flags: number,
  hitPoint: Vec3,
  _hitNormal: Vec3,
  state: PowerArmorState,
  options: PowerArmorOptions = {},
): PowerArmorResult {
  if (state.health <= 0 || damage <= 0) {
    return { saved: 0, remainingCells: state.cellCount };
  }

  if (hasAnyDamageFlag(flags, DamageFlags.NO_ARMOR | DamageFlags.NO_POWER_ARMOR)) {
    return { saved: 0, remainingCells: state.cellCount };
  }

  if (!state.type || state.cellCount <= 0) {
    return { saved: 0, remainingCells: state.cellCount };
  }

  // Quake 2 Power Screen direction check:
  // "if (dot < 0.3) return 0;"
  // where dot is DotProduct(dir, forward)
  // dir is direction from player origin to impact point.
  // forward is player's view direction.
  const { forward } = angleVectors(state.angles);
  const toImpact = {
    x: hitPoint.x - state.origin.x,
    y: hitPoint.y - state.origin.y,
    z: hitPoint.z - state.origin.z,
  };
  const toImpactLength = Math.hypot(toImpact.x, toImpact.y, toImpact.z);

  if (state.type === 'screen' && toImpactLength > 0) {
    const dir = {
      x: toImpact.x / toImpactLength,
      y: toImpact.y / toImpactLength,
      z: toImpact.z / toImpactLength,
    };
    const dot = dir.x * forward.x + dir.y * forward.y + dir.z * forward.z;
    if (dot <= 0.3) {
      return { saved: 0, remainingCells: state.cellCount };
    }
  }

  const ctfMode = options.ctfMode ?? false;
  const damagePerCell = state.type === 'screen' ? 1 : ctfMode ? 1 : 2;
  let adjustedDamage = state.type === 'screen' ? damage / 3 : (2 * damage) / 3;
  adjustedDamage = Math.max(1, adjustedDamage);

  let saved = state.cellCount * damagePerCell;
  if (hasAnyDamageFlag(flags, DamageFlags.ENERGY)) {
    saved = Math.max(1, Math.floor(saved / 2));
  }

  if (saved > adjustedDamage) {
    saved = Math.floor(adjustedDamage);
  }

  let powerUsed = saved / damagePerCell;
  if (hasAnyDamageFlag(flags, DamageFlags.ENERGY)) {
    powerUsed *= 2;
  }
  powerUsed = Math.max(1, Math.floor(powerUsed));

  const cellsSpent = Math.max(damagePerCell, powerUsed);
  const remainingCells = Math.max(0, state.cellCount - cellsSpent);

  return { saved, remainingCells };
}
