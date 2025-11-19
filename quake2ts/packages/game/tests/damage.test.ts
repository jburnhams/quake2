import { describe, expect, it, vi } from 'vitest';
import { ArmorType, DamageFlags, DamageMod, EntityDamageFlags, T_Damage, T_RadiusDamage, type Damageable } from '../src/combat/index.js';

type PartialEntity = Partial<Damageable> & Pick<Damageable, 'origin'>;

const MOD_UNKNOWN = DamageMod.UNKNOWN;

function makeEntity(partial: PartialEntity): Damageable {
  return {
    takedamage: true,
    health: 100,
    velocity: { x: 0, y: 0, z: 0 },
    ...partial,
  } as Damageable;
}

describe('T_Damage', () => {
  it('applies power armor before regular armor and updates stores', () => {
    const target = makeEntity({
      origin: { x: 0, y: 0, z: 0 },
      powerArmor: { type: 'shield', cellCount: 10, angles: { x: 0, y: 0, z: 0 }, origin: { x: 0, y: 0, z: 0 }, health: 100 },
      regularArmor: { armorType: ArmorType.BODY, armorCount: 100 },
    });

    const result = T_Damage(target, null, null, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 60, 0, DamageFlags.NONE, MOD_UNKNOWN);

    expect(result).toEqual({
      take: 8,
      psave: 20,
      asave: 32,
      knocked: { x: 0, y: 0, z: 0 },
      killed: false,
      remainingCells: 0,
      remainingArmor: 68,
    });
    expect(target.health).toBe(92);
    expect(target.powerArmor?.cellCount).toBe(0);
    expect(target.regularArmor?.armorCount).toBe(68);
  });

  it('scales knockback for self damage', () => {
    const target = makeEntity({ origin: { x: 0, y: 0, z: 0 }, mass: 100 });
    const result = T_Damage(target, target, target, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 10, 50, DamageFlags.NONE, MOD_UNKNOWN);

    expect(result?.knocked).toEqual({ x: 800, y: 0, z: 0 });
    expect(target.velocity).toEqual({ x: 800, y: 0, z: 0 });
  });

  it('ignores damage when godmode is active without NO_PROTECTION', () => {
    const target = makeEntity({ origin: { x: 0, y: 0, z: 0 }, flags: EntityDamageFlags.GODMODE });
    const result = T_Damage(target, null, null, { x: 0, y: 1, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 25, 0, DamageFlags.NONE, MOD_UNKNOWN);

    expect(result).toEqual({
      take: 0,
      psave: 0,
      asave: 25,
      knocked: { x: 0, y: 0, z: 0 },
      killed: false,
    });
    expect(target.health).toBe(100);
  });

  it('emits pain callbacks for surviving damage', () => {
    const pain = vi.fn();
    const target = makeEntity({ origin: { x: 0, y: 0, z: 0 }, pain });

    const result = T_Damage(target, null, null, { x: 0, y: 1, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 30, 0, DamageFlags.NONE, MOD_UNKNOWN);

    expect(result?.take).toBe(30);
    expect(pain).toHaveBeenCalledWith(target, null, 0, 30, MOD_UNKNOWN);
  });
});

describe('T_RadiusDamage', () => {
  it('applies linear falloff and halves self damage', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const attacker = makeEntity({ origin: { x: 10, y: 0, z: 0 } });
    const victim = makeEntity({ origin: { x: 120, y: 0, z: 0 } });

    const hits = T_RadiusDamage([attacker, victim], inflictor, attacker, 120, null, 200, DamageFlags.NONE, MOD_UNKNOWN);

    expect(hits).toHaveLength(2);
    const attackerHit = hits.find((hit) => hit.target === attacker)!;
    const victimHit = hits.find((hit) => hit.target === victim)!;

    expect(attackerHit.appliedDamage).toBeCloseTo((120 - 0.5 * 10) * 0.5);
    expect(victimHit.appliedDamage).toBeCloseTo(120 - 0.5 * 120);
    expect(attacker.health).toBeLessThan(100);
    expect(victim.health).toBeLessThan(100);
  });

  it('skips untouchable targets and ignored entity', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const ignored = makeEntity({ origin: { x: 0, y: 0, z: 0 } });
    const untouchable = makeEntity({ origin: { x: 50, y: 0, z: 0 }, takedamage: false });
    const victim = makeEntity({ origin: { x: 50, y: 0, z: 0 } });

    const hits = T_RadiusDamage([ignored, untouchable, victim], inflictor, null, 80, ignored, 100, DamageFlags.NONE, MOD_UNKNOWN);

    expect(hits.map((hit) => hit.target)).toEqual([victim]);
    expect(victim.health).toBeLessThan(100);
  });

  it('uses custom canDamage checks for line-of-sight gating', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const blocked = makeEntity({ origin: { x: 20, y: 0, z: 0 } });
    const visible = makeEntity({ origin: { x: 40, y: 0, z: 0 } });

    const hits = T_RadiusDamage(
      [blocked, visible],
      inflictor,
      null,
      60,
      null,
      100,
      DamageFlags.NONE,
      MOD_UNKNOWN,
      {
        canDamage: (ent) => ent === visible,
      },
    );

    expect(hits).toHaveLength(1);
    expect(hits[0].target).toBe(visible);
    expect(visible.health).toBeLessThan(100);
    expect(blocked.health).toBe(100);
  });

  it('respects the requested radius instead of scaling purely by damage', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const close = makeEntity({ origin: { x: 10, y: 0, z: 0 } });
    const far = makeEntity({ origin: { x: 80, y: 0, z: 0 } });

    const hits = T_RadiusDamage([close, far], inflictor, null, 200, null, 30, DamageFlags.NONE, MOD_UNKNOWN);

    expect(hits.map((hit) => hit.target)).toEqual([close]);
    expect(close.health).toBeLessThan(100);
    expect(far.health).toBe(100);
  });

  it('uses bounding boxes relative to origin when measuring explosion distance', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const tallBox = makeEntity({ origin: { x: 100, y: 0, z: 0 }, mins: { x: -16, y: -16, z: 0 }, maxs: { x: 16, y: 16, z: 56 } });

    const hits = T_RadiusDamage([tallBox], inflictor, null, 120, null, 50, DamageFlags.NONE, MOD_UNKNOWN);

    expect(hits).toHaveLength(0);
    expect(tallBox.health).toBe(100);
  });
});
