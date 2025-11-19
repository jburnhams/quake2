import { describe, expect, it } from 'vitest';
import {
  applyPowerArmor,
  applyRegularArmor,
  ArmorType,
  DamageFlags,
  type PowerArmorState,
  type RegularArmorState,
} from '../src/combat/index.js';

const ORIGIN = { x: 0, y: 0, z: 0 } as const;
const FORWARD_ANGLES = { x: 0, y: 0, z: 0 } as const;

function regularState(armorType: ArmorType | null, armorCount: number): RegularArmorState {
  return { armorType, armorCount };
}

function powerState(partial: Partial<PowerArmorState> = {}): PowerArmorState {
  return {
    type: null,
    cellCount: 0,
    angles: FORWARD_ANGLES,
    origin: ORIGIN,
    health: 100,
    ...partial,
  };
}

describe('regular armor absorption', () => {
  it('uses normal protection values and caps at available armor', () => {
    const result = applyRegularArmor(50, DamageFlags.NONE, regularState(ArmorType.BODY, 200));
    expect(result).toEqual({ saved: 40, remainingArmor: 160 });
  });

  it('uses energy protection when DAMAGE_ENERGY is set', () => {
    const result = applyRegularArmor(50, DamageFlags.ENERGY, regularState(ArmorType.BODY, 200));
    expect(result).toEqual({ saved: 30, remainingArmor: 170 });
  });

  it('returns only the available armor when protection exceeds stored amount', () => {
    const result = applyRegularArmor(30, DamageFlags.NONE, regularState(ArmorType.JACKET, 5));
    expect(result).toEqual({ saved: 5, remainingArmor: 0 });
  });

  it('ignores armor when DAMAGE_NO_ARMOR or DAMAGE_NO_REG_ARMOR are set', () => {
    const result = applyRegularArmor(30, DamageFlags.NO_ARMOR | DamageFlags.NO_REG_ARMOR, regularState(ArmorType.COMBAT, 80));
    expect(result).toEqual({ saved: 0, remainingArmor: 80 });
  });
});

describe('power armor absorption', () => {
  it('absorbs frontal hits for screens and spends cells', () => {
    const state = powerState({ type: 'screen', cellCount: 5 });
    const result = applyPowerArmor(30, DamageFlags.NONE, { x: 10, y: 0, z: 0 }, ORIGIN, state);
    expect(result).toEqual({ saved: 5, remainingCells: 0 });
  });

  it('ignores rear hits for screens based on facing dot threshold', () => {
    const state = powerState({ type: 'screen', cellCount: 5 });
    const result = applyPowerArmor(30, DamageFlags.NONE, { x: -10, y: 0, z: 0 }, ORIGIN, state);
    expect(result).toEqual({ saved: 0, remainingCells: 5 });
  });

  it('reduces energy absorption and doubles cell spend for shields', () => {
    const state = powerState({ type: 'shield', cellCount: 10 });
    const result = applyPowerArmor(30, DamageFlags.ENERGY, { x: 0, y: 0, z: 0 }, ORIGIN, state);
    expect(result).toEqual({ saved: 10, remainingCells: 0 });
  });

  it('uses weaker cell cost when CTF mode is enabled', () => {
    const state = powerState({ type: 'shield', cellCount: 5 });
    const result = applyPowerArmor(30, DamageFlags.NONE, { x: 0, y: 0, z: 0 }, ORIGIN, state, { ctfMode: true });
    expect(result).toEqual({ saved: 5, remainingCells: 0 });
  });
});
