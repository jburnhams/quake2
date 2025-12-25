import { describe, it, expect, vi, beforeEach } from 'vitest';
import { T_Damage, Damageable, DamageOptions } from '../../src/combat/damage.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { Vec3 } from '@quake2ts/shared';
import { PlayerClient } from '../../src/inventory/playerInventory.js';
import { createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('T_Damage Indicator Logic', () => {
    let attacker: Entity;
    let target: Entity;

    beforeEach(() => {
        attacker = createEntityFactory({
             origin: { x: 100, y: 100, z: 0 },
             takedamage: true
        }) as Entity;

        target = createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 },
            health: 100,
            takedamage: true,
            solid: Solid.BoundingBox,
            movetype: MoveType.Walk,
            client: {
                damage_indicators: [],
                // Ensure inventory.items exists for hasItem check in T_Damage -> applyProtection
                inventory: {
                    items: new Set(),
                    powerups: new Map(),
                    ammo: { counts: [] },
                    ownedWeapons: new Set(),
                    keys: new Set(),
                }
            } as any
        }) as Entity;
        target.pain = vi.fn();
        target.die = vi.fn();
    });

    it('should add a damage indicator to the target client when damaged by attacker', () => {
        // Attack from (100, 100, 0)
        // Target at (0, 0, 0)
        // Direction vector passed to T_Damage (knockback dir) is normalized(target - attacker) = (-0.707, -0.707, 0)
        const dir = { x: -0.7071, y: -0.7071, z: 0 };
        const point = { x: 0, y: 0, z: 0 };
        const normal = { x: 1, y: 0, z: 0 }; // Arbitrary
        const damage = 20;

        T_Damage(target as unknown as Damageable, null, attacker as unknown as Damageable, dir, point, normal, damage, 0, 0, DamageMod.UNKNOWN, 0);

        expect(target.client!.damage_indicators).toBeDefined();
        expect(target.client!.damage_indicators!.length).toBe(1);

        const indicator = target.client!.damage_indicators![0];
        // Direction should point TO attacker: (100, 100, 0) - (0,0,0) normalized
        const expectedDir = { x: 0.7071, y: 0.7071, z: 0 };

        expect(indicator.direction.x).toBeCloseTo(expectedDir.x, 3);
        expect(indicator.direction.y).toBeCloseTo(expectedDir.y, 3);
        expect(indicator.strength).toBeCloseTo(1.0); // 20 damage -> 1.0 strength
    });

    it('should initialize damage_indicators array if missing', () => {
        target.client!.damage_indicators = undefined; // Force undefined
        const dir = { x: 0, y: 0, z: 0 };
        T_Damage(target as unknown as Damageable, null, attacker as unknown as Damageable, dir, {x:0,y:0,z:0}, {x:0,y:0,z:0}, 10, 0, 0, DamageMod.UNKNOWN, 0);

        expect(target.client!.damage_indicators).toBeDefined();
        expect(target.client!.damage_indicators!.length).toBe(1);
    });

    it('should calculate strength based on damage amount (capped at 1.0)', () => {
        const damage = 10; // Half strength
        const dir = { x: 0, y: 0, z: 0 };
        T_Damage(target as unknown as Damageable, null, attacker as unknown as Damageable, dir, {x:0,y:0,z:0}, {x:0,y:0,z:0}, damage, 0, 0, DamageMod.UNKNOWN, 0);

        expect(target.client!.damage_indicators![0].strength).toBeCloseTo(0.5);
    });
});
