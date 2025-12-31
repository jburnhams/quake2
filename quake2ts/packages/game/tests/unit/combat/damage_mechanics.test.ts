import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ArmorType, DamageFlags, DamageMod, EntityDamageFlags, T_Damage, T_RadiusDamage } from '../../../src/combat/index.js';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { Entity } from '../../../src/entities/entity.js';
import { AmmoType } from '../../../src/inventory/ammo.js';

const MOD_UNKNOWN = DamageMod.UNKNOWN;

// Helper to create full Entity from factory
function spawnEntity(context: any, factoryData: Partial<Entity>) {
    const ent = context.spawn();
    Object.assign(ent, factoryData);
    return ent;
}

describe('T_Damage', () => {
  let context: any;

  beforeEach(() => {
    const ctx = createTestContext();
    context = ctx.entities;
  });

  it('applies power armor before regular armor and updates stores', () => {
    const target = spawnEntity(context, createPlayerEntityFactory({
      origin: { x: 0, y: 0, z: 0 },
      regularArmor: { armorType: ArmorType.BODY, armorCount: 100 },
    }));

    // Setup Power Armor via inventory (required for Player entities)
    if (target.client) {
        target.client.inventory.items.add('item_power_shield');
        target.client.inventory.ammo.counts[AmmoType.Cells] = 10;
        // Angles required for shield direction check
        target.client.v_angle = { x: 0, y: 0, z: 0 };
        target.angles = { x: 0, y: 0, z: 0 };
    }

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
    const target = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 }, mass: 100 }));
    const result = T_Damage(target, target, target, { x: 1, y: 0, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 10, 50, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(result?.knocked).toEqual({ x: 800, y: 0, z: 0 });
    expect(target.velocity).toEqual({ x: 800, y: 0, z: 0 });
  });

  it('ignores damage when godmode is active without NO_PROTECTION', () => {
    const target = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 }, flags: EntityDamageFlags.GODMODE }));
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
    const target = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 } }));
    target.pain = pain;

    const result = T_Damage(target, null, null, { x: 0, y: 1, z: 0 }, target.origin, { x: 0, y: 0, z: 1 }, 30, 0, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(result?.take).toBe(30);
    expect(pain).toHaveBeenCalledWith(target, null, 0, 30, MOD_UNKNOWN);
  });
});

describe('T_RadiusDamage', () => {
  let context: any;

  beforeEach(() => {
    const ctx = createTestContext();
    context = ctx.entities;
  });

  it('applies linear falloff and halves self damage', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const attacker = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 10, y: 0, z: 0 } }));
    const victim = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 120, y: 0, z: 0 } }));

    const hits = T_RadiusDamage([attacker, victim], inflictor as any, attacker, 120, null, 200, DamageFlags.NONE, MOD_UNKNOWN, 0);

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
    const ignored = spawnEntity(context, createEntityFactory({ origin: { x: 0, y: 0, z: 0 } }));
    const untouchable = spawnEntity(context, createEntityFactory({ origin: { x: 50, y: 0, z: 0 }, takedamage: false }));
    const victim = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 50, y: 0, z: 0 } }));

    const hits = T_RadiusDamage([ignored, untouchable, victim], inflictor as any, null, 80, ignored, 100, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits.map((hit) => hit.target)).toEqual([victim]);
    expect(victim.health).toBeLessThan(100);
  });

  it('uses custom canDamage checks for line-of-sight gating', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const blocked = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 20, y: 0, z: 0 } }));
    const visible = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 40, y: 0, z: 0 } }));

    const hits = T_RadiusDamage(
      [blocked, visible],
      inflictor as any,
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
    const close = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 10, y: 0, z: 0 } }));
    const far = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 80, y: 0, z: 0 } }));

    const hits = T_RadiusDamage([close, far], inflictor as any, null, 200, null, 30, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits.map((hit) => hit.target)).toEqual([close]);
    expect(close.health).toBeLessThan(100);
    expect(far.health).toBe(100);
  });

  it('uses bounding boxes relative to origin when measuring explosion distance', () => {
    const inflictor = { origin: { x: 0, y: 0, z: 0 } };
    const tallBox = spawnEntity(context, createEntityFactory({
      origin: { x: 100, y: 0, z: 0 },
      mins: { x: -16, y: -16, z: 0 },
      maxs: { x: 16, y: 16, z: 56 },
      takedamage: true,
      health: 100
    }));

    const hits = T_RadiusDamage([tallBox], inflictor as any, null, 120, null, 50, DamageFlags.NONE, MOD_UNKNOWN, 0);

    expect(hits).toHaveLength(0);
    expect(tallBox.health).toBe(100);
  });
});

describe('Damage Modifiers', () => {
    const time = 10;
    let context: any;
    let attacker: Entity;
    let target: Entity;

    const damage = 10;
    const knockback = 20;

    beforeEach(() => {
        const ctx = createTestContext();
        context = ctx.entities;

        // Use factory and then explicitly hydrate the client property as factories might not fully populate it by default
        attacker = spawnEntity(context, createPlayerEntityFactory({ origin: { x: 0, y: 0, z: 0 } }));
        if (!attacker.client) {
            (attacker as any).client = { quad_time: 0, double_time: 0 };
        } else {
            attacker.client.quad_time = 0;
            attacker.client.double_time = 0;
        }

        target = spawnEntity(context, createEntityFactory({
            origin: { x: 50, y: 0, z: 0 },
            takedamage: true,
            health: 100
        }));
    });


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
