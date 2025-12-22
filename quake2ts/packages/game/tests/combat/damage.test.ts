import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ArmorType, DamageFlags, DamageMod, EntityDamageFlags, T_Damage, T_RadiusDamage } from '../../src/combat/index.js';
import { createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

const MOD_UNKNOWN = DamageMod.UNKNOWN;

describe('T_Damage', () => {
  it('applies power armor before regular armor and updates stores', () => {
    const target = createPlayerEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
      powerArmor: { type: 'shield', cellCount: 10, angles: { x: 0, y: 0, z: 0 }, origin: { x: 0, y: 0, z: 0 }, health: 100 },
      regularArmor: { armorType: ArmorType.BODY, armorCount: 100 },
    });

    const result = T_Damage(target, null, null, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 60, 0, DamageFlags.NONE, MOD_UNKNOWN, 0);

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
    const target = createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 }, mass: 100 });
    const result = T_Damage(target, target, target, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 10, 50, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(result?.knocked).toEqual({ x: 800, y: 0, z: 0 });
    expect(target.velocity).toEqual({ x: 800, y: 0, z: 0 });
  });

  it('ignores damage when godmode is active without NO_PROTECTION', () => {
    const target = createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 }, flags: EntityDamageFlags.GODMODE });
    const result = T_Damage(target, null, null, { x: 0, y: 1, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 25, 0, DamageFlags.NONE, MOD_UNKNOWN, 0);

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
    const target = createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 }, pain });

    const result = T_Damage(target, null, null, { x: 0, y: 1, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 30, 0, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(result?.take).toBe(30);
    expect(pain).toHaveBeenCalledWith(target, null, 0, 30, MOD_UNKNOWN);
  });
});

describe('T_RadiusDamage', () => {
  it('applies linear falloff and halves self damage', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const attacker = createPlayerEntityFactory({ origin: { x: 10, y: 0, z: 0 } });
    const victim = createPlayerEntityFactory({ origin: { x: 120, y: 0, z: 0 } });

    const hits = T_RadiusDamage([attacker, victim], inflictor, attacker, 120, null, 200, DamageFlags.NONE, MOD_UNKNOWN, 0);

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
    const ignored = createEntityFactory({ origin: { x: 0, y: 0, z: 0 } });
    const untouchable = createEntityFactory({ origin: { x: 50, y: 0, z: 0 }, takedamage: false });
    const victim = createPlayerEntityFactory({ origin: { x: 50, y: 0, z: 0 } });

    const hits = T_RadiusDamage([ignored, untouchable, victim], inflictor, null, 80, ignored, 100, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits.map((hit) => hit.target)).toEqual([victim]);
    expect(victim.health).toBeLessThan(100);
  });

  it('uses custom canDamage checks for line-of-sight gating', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const blocked = createPlayerEntityFactory({ origin: { x: 20, y: 0, z: 0 } });
    const visible = createPlayerEntityFactory({ origin: { x: 40, y: 0, z: 0 } });

    const hits = T_RadiusDamage(
      [blocked, visible],
      inflictor,
      null,
      60,
      null,
      100,
      DamageFlags.NONE,
      MOD_UNKNOWN,
      0,
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
    const close = createPlayerEntityFactory({ origin: { x: 10, y: 0, z: 0 } });
    const far = createPlayerEntityFactory({ origin: { x: 80, y: 0, z: 0 } });

    const hits = T_RadiusDamage([close, far], inflictor, null, 200, null, 30, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits.map((hit) => hit.target)).toEqual([close]);
    expect(close.health).toBeLessThan(100);
    expect(far.health).toBe(100);
  });

  it('uses bounding boxes relative to origin when measuring explosion distance', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const tallBox = createEntityFactory({
      origin: { x: 100, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: 0 },
      maxs: { x: 16, y: 16, z: 56 },
      takedamage: true,
      health: 100
    });

    const hits = T_RadiusDamage([tallBox], inflictor, null, 120, null, 50, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits).toHaveLength(0);
    expect(tallBox.health).toBe(100);
  });
});

describe('Damage Modifiers', () => {
    const time = 10;
    // createPlayerEntityFactory ensures client is not null but we might need to populate properties further if factory doesn't
    // The previous test manually assigned client = {} as any, but createPlayerEntityFactory (from checking source) returns generic Entity with client being undefined by default?
    // Wait, createPlayerEntityFactory implementation in factories.ts:
    // returns createEntityFactory({...}) which returns new Entity(1). Entity class has client?: Client.
    // So createPlayerEntityFactory DOES NOT pre-populate client unless overrides do.
    // Task 1.3 says "Pre-set: classname: 'player', health: 100, playerState, client info".
    // But checking `factories.ts` content I read, `createPlayerEntityFactory` does NOT populate `client` or `playerState` (except implicit defaults of Entity?).
    // Ah, wait, `factories.ts` calls `createEntityFactory` with `classname: 'player'`. It doesn't set `client`.
    // So I still need to manually set `client`.

    const attacker = createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 } });
    // Manually setting client for now as factory doesn't seem to do it fully yet based on my read
    (attacker as any).client = { quad_time: 0, double_time: 0 };

    const target = createEntityFactory({
        origin: { x: 50, y: 0, z: 0 },
        takedamage: true,
        health: 100
    });
    const damage = 10;

    beforeEach(() => {
        (attacker as any).client.quad_time = 0;
        (attacker as any).client.double_time = 0;
        target.health = 100;
    });
    const knockback = 20;

    it('applies no modifier when no powerups are active', () => {
        const result = T_Damage(target, attacker, attacker, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, damage, knockback, DamageFlags.NONE, MOD_UNKNOWN, time);
        expect(result?.take).toBe(damage);
    });

    it('applies quad damage modifier', () => {
        (attacker as any).client.quad_time = time + 5;
        const result = T_Damage(target, attacker, attacker, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, damage, knockback, DamageFlags.NONE, MOD_UNKNOWN, time);
        expect(result?.take).toBe(damage * 4);
    });

    it('applies double damage modifier', () => {
        (attacker as any).client.double_time = time + 5;
        const result = T_Damage(target, attacker, attacker, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, damage, knockback, DamageFlags.NONE, MOD_UNKNOWN, time);
        expect(result?.take).toBe(damage * 2);
    });

    it('applies both quad and double damage modifiers', () => {
        (attacker as any).client.quad_time = time + 5;
        (attacker as any).client.double_time = time + 5;
        const result = T_Damage(target, attacker, attacker, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, damage, knockback, DamageFlags.NONE, MOD_UNKNOWN, time);
        expect(result?.take).toBe(damage * 8);
    });

    it('does not apply expired powerups', () => {
        (attacker as any).client.quad_time = time - 5;
        const result = T_Damage(target, attacker, attacker, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, damage, knockback, DamageFlags.NONE, MOD_UNKNOWN, time);
        expect(result?.take).toBe(damage);
    });
});
