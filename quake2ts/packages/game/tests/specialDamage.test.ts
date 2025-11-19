import { CONTENTS_LAVA, CONTENTS_SLIME, WaterLevel, type Vec3 } from '@quake2ts/shared';
import { describe, expect, it } from 'vitest';

import {
  DamageMod,
  ArmorType,
  applyEnvironmentalDamage,
  applyFallingDamage,
  calculateFallingDamage,
  applyCrushDamage,
  killBox,
  type Damageable,
  EnvironmentalFlags,
} from '../src/combat/index.js';
import { MoveType, Solid } from '../src/entities/entity.js';
import { EntityDamageFlags } from '../src/combat/damage.js';

function makeTarget(extra: Partial<Damageable> = {}) {
  return {
    takedamage: true,
    health: 100,
    velocity: { x: 0, y: 0, z: 0 },
    origin: { x: 0, y: 0, z: 0 },
    waterlevel: WaterLevel.None,
    watertype: 0,
    airFinished: 0,
    painDebounceTime: 0,
    damageDebounceTime: 0,
    ...extra,
  } as any;
}

describe('applyEnvironmentalDamage', () => {
  it('applies drowning damage that scales over time and respects pain debounce', () => {
    const now = 5000;
    const target = makeTarget({ airFinished: now - 3000 });

    const result = applyEnvironmentalDamage(target, now);

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({ mod: DamageMod.WATER, amount: 8 });
    expect(target.health).toBe(92);
    expect(target.painDebounceTime).toBe(now + 1000);

    const second = applyEnvironmentalDamage(target, now + 500);
    expect(second.events).toHaveLength(0);
    expect(target.health).toBe(92);
  });

  it('damages entities immersed in lava while honoring immunity flags', () => {
    const now = 250;
    const target = makeTarget({ waterlevel: WaterLevel.Waist, watertype: CONTENTS_LAVA });

    const result = applyEnvironmentalDamage(target, now);

    expect(result.events[0]).toMatchObject({ mod: DamageMod.LAVA, amount: 20 });
    expect(target.health).toBe(80);
    expect(target.damageDebounceTime).toBe(now + 100);

    target.environmentFlags = EnvironmentalFlags.IMMUNE_LAVA;
    target.health = 100;
    const immuneResult = applyEnvironmentalDamage(target, now + 200);
    expect(immuneResult.events).toHaveLength(0);
    expect(target.health).toBe(100);
  });

  it('applies slime ticks with the same 100ms cadence and multiplier', () => {
    const now = 1000;
    const target = makeTarget({ waterlevel: WaterLevel.Under, watertype: CONTENTS_SLIME });

    const result = applyEnvironmentalDamage(target, now);

    expect(result.events[0]).toMatchObject({ mod: DamageMod.SLIME, amount: 12 });
    expect(target.damageDebounceTime).toBe(now + 100);
    expect(target.health).toBe(88);
  });

  it('tracks water entry/exit state so callers can trigger ambience', () => {
    const now = 0;
    const target = makeTarget({ waterlevel: WaterLevel.Waist, airFinished: -5000 });

    const first = applyEnvironmentalDamage(target, now);
    expect(first.enteredWater).toBe(true);
    expect(first.leftWater).toBe(false);
    expect((target.environmentFlags ?? 0) & EnvironmentalFlags.IN_WATER).toBe(EnvironmentalFlags.IN_WATER);
    expect(target.airFinished).toBe(now + 9000);

    target.waterlevel = WaterLevel.None;
    const second = applyEnvironmentalDamage(target, now + 50);
    expect(second.enteredWater).toBe(false);
    expect(second.leftWater).toBe(true);
    expect((target.environmentFlags ?? 0) & EnvironmentalFlags.IN_WATER).toBe(0);
  });
});

describe('calculateFallingDamage', () => {
  it('matches the rerelease delta and damage math for hard landings', () => {
    const result = calculateFallingDamage({ impactDelta: 800, waterLevel: WaterLevel.None });

    expect(result.adjustedDelta).toBeCloseTo(64);
    expect(result.damage).toBeCloseTo(17);
    expect(result.event).toBe('fallfar');
    expect(result.fallValue).toBeCloseTo(32);
  });

  it('omits damage when underwater, on ladders, or asked to skip the pain', () => {
    const underwater = calculateFallingDamage({ impactDelta: 1200, waterLevel: WaterLevel.Under });
    expect(underwater.damage).toBe(0);
    expect(underwater.event).toBeNull();

    const ladder = calculateFallingDamage({ impactDelta: 300, waterLevel: WaterLevel.None, onLadder: true });
    expect(ladder.event).toBeNull();

    const skipped = calculateFallingDamage({ impactDelta: 1200, waterLevel: WaterLevel.None, skipDamage: true });
    expect(skipped.event).toBe('fallfar');
    expect(skipped.damage).toBe(0);
  });

  it('caps landmark freefalls to prevent damage when the rerelease would', () => {
    const clamped = calculateFallingDamage({ impactDelta: 1200, waterLevel: WaterLevel.None, clampFreeFall: true });
    expect(clamped.adjustedDelta).toBe(30);
    expect(clamped.damage).toBe(0);
    expect(clamped.event).toBe('fallshort');
  });
});

describe('applyFallingDamage', () => {
  it('routes fatal landings through T_Damage with the MOD_FALLING reason', () => {
    const target = makeTarget();

    const result = applyFallingDamage(target, { impactDelta: 800, waterLevel: WaterLevel.None });

    expect(result.damage).toBeGreaterThan(0);
    expect(target.health).toBeCloseTo(83);
  });

  it('bypasses armor so fall damage cannot be absorbed', () => {
    const target = makeTarget({
      regularArmor: { armorType: ArmorType.BODY, armorCount: 100 },
      powerArmor: {
        type: 'shield',
        cellCount: 5,
        angles: { x: 0, y: 0, z: 0 },
        origin: { x: 0, y: 0, z: 0 },
        health: 100,
      },
    });

    const result = applyFallingDamage(target, { impactDelta: 800, waterLevel: WaterLevel.None });

    expect(result.damage).toBeGreaterThan(0);
    expect(target.health).toBeCloseTo(83);
    expect(target.regularArmor?.armorCount).toBe(100);
    expect(target.powerArmor?.cellCount).toBe(5);
  });

  it('keeps minor landings to footstep events without harming health', () => {
    const target = makeTarget();

    const result = applyFallingDamage(target, { impactDelta: 300, waterLevel: WaterLevel.None });

    expect(result.event).toBe('footstep');
    expect(result.damage).toBe(0);
    expect(target.health).toBe(100);
  });
});

function makeCrushTarget(extra: Partial<Damageable> & { isMonster?: boolean; isClient?: boolean } = {}) {
  return {
    takedamage: true,
    health: 50,
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    isMonster: false,
    isClient: false,
    ...extra,
  } as any;
}

describe('applyCrushDamage', () => {
  it('instantly destroys non-living blockers the same way plats and doors do', () => {
    const crusher = makeTarget({ dmg: 10 });
    const debris = makeCrushTarget({ health: 200, isMonster: false, isClient: false });

    const { amount, result } = applyCrushDamage(crusher as any, debris as any);

    expect(amount).toBe(100_000);
    expect(result?.killed).toBe(true);
    expect(debris.health).toBeLessThanOrEqual(0);
  });

  it('uses a separate gibbing damage pass for corpses before the main crush tick', () => {
    const crusher = makeTarget({ dmg: 4 });
    const corpse = makeCrushTarget({ health: 0, isMonster: true, isClient: false });

    const { amount } = applyCrushDamage(crusher as any, corpse as any, { gibDamage: 75 });

    expect(amount).toBe(75);
    expect(corpse.health).toBeLessThan(0);
  });

  it('falls back to the crusher damage amount for living monsters/players', () => {
    const crusher = makeTarget({ dmg: 4 });
    const marine = makeCrushTarget({ health: 30, isMonster: true, isClient: true });

    const { amount } = applyCrushDamage(crusher as any, marine as any, { baseDamage: 12 });

    expect(amount).toBe(12);
    expect(marine.health).toBe(18);
  });
});

function makeTelefragTarget(extra: Partial<Damageable> & { mins?: Vec3; maxs?: Vec3; inUse?: boolean } = {}) {
  const mins = extra.mins ?? { x: -16, y: -16, z: -16 };
  const maxs = extra.maxs ?? { x: 16, y: 16, z: 16 };

  return {
    takedamage: true,
    health: 100,
    origin: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    mins,
    maxs,
    solid: Solid.BoundingBox,
    inUse: true,
    ...extra,
  } as any;
}

describe('killBox', () => {
  it('telefrags overlapping solids using MOD_TELEFRAG parity values', () => {
    const teleporter = makeTelefragTarget({ origin: { x: 8, y: 8, z: 8 }, movetype: MoveType.Walk });
    const victim = makeTelefragTarget({ origin: { x: 0, y: 0, z: 0 } });

    const result = killBox(teleporter as any, [victim as any]);

    expect(result.events).toHaveLength(1);
    expect(result.events[0].result?.killed).toBe(true);
    expect(result.cleared).toBe(true);
    expect(victim.health).toBeLessThanOrEqual(0);
  });

  it('skips telefragging spectators and returns a cleared area', () => {
    const teleporter = makeTelefragTarget({ movetype: MoveType.Noclip });
    const victim = makeTelefragTarget({});

    const result = killBox(teleporter as any, [victim as any]);

    expect(result.events).toHaveLength(0);
    expect(result.cleared).toBe(true);
    expect(victim.health).toBe(100);
  });

  it('reports uncleared space when immortal entities survive the telefrag', () => {
    const teleporter = makeTelefragTarget({});
    const protectedTarget = makeTelefragTarget({ flags: EntityDamageFlags.IMMORTAL });

    const result = killBox(teleporter as any, [protectedTarget as any]);

    expect(result.events).toHaveLength(1);
    expect(result.cleared).toBe(false);
    expect(protectedTarget.health).toBe(1);
  });
});
