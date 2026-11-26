import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Entity, Solid } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { T_Damage } from '../../../src/combat/damage.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { PlayerClient, createPlayerInventory, pickupPowerArmor } from '../../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../../../src/combat/weapons/state.js';
import { POWER_ARMOR_ITEMS } from '../../../src/inventory/items.js';
import { AmmoType, addAmmo } from '../../../src/inventory/ammo.js';

describe('T_Damage power armor integration', () => {
    let target: Entity;

    beforeEach(() => {
        target = new Entity(1);
        target.takedamage = true;
        target.health = 100;
        target.mass = 200;
        target.solid = Solid.Bsp;
        target.angles = { x: 0, y: 0, z: 0 }; // Facing East (0 degrees yaw)
        target.origin = { x: 0, y: 0, z: 0 };
        target.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
        };
    });

    it('absorbs damage with power screen and consumes cells', () => {
        // Give power screen and cells
        pickupPowerArmor(target.client!.inventory, POWER_ARMOR_ITEMS['item_power_screen'], 0);
        addAmmo(target.client!.inventory.ammo, AmmoType.Cells, 50);

        // Hit from front (attacker is East, target facing East, hitpoint in front?)
        // Wait. If target faces East (0,0,0), their "Forward" is (+1, 0, 0).
        // If they are hit at (50, 0, 0), the hit is IN FRONT.
        // applyPowerArmor logic: dot(normalize(hitPoint - origin), forward).
        // (50,0,0) - (0,0,0) = (50,0,0). Normalized = (1,0,0).
        // Forward = (1,0,0). Dot = 1. 1 > 0.3. Protected.

        const hitPoint = { x: 50, y: 0, z: 0 };
        const dir = { x: -1, y: 0, z: 0 };
        const damage = 30;

        const result = T_Damage(
            target,
            null,
            null,
            dir,
            hitPoint,
            { x: 1, y: 0, z: 0 },
            damage,
            0,
            0,
            DamageMod.UNKNOWN
        );

        expect(result?.psave).toBe(10);
        expect(result?.take).toBe(20);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(40);
        expect(target.health).toBe(80);
    });

    it('does NOT absorb damage with power screen from behind', () => {
        // Give power screen and cells
        pickupPowerArmor(target.client!.inventory, POWER_ARMOR_ITEMS['item_power_screen'], 0);
        addAmmo(target.client!.inventory.ammo, AmmoType.Cells, 50);

        // Hit from behind (attacker is West, target facing East).
        // HitPoint at (-50, 0, 0).
        // ( -50, 0, 0 ) - (0,0,0) = (-50,0,0). Normalized = (-1,0,0).
        // Forward = (1,0,0). Dot = -1. -1 <= 0.3. NOT Protected.

        const hitPoint = { x: -50, y: 0, z: 0 };
        const dir = { x: 1, y: 0, z: 0 };
        const damage = 30;

        const result = T_Damage(
            target,
            null,
            null,
            dir,
            hitPoint,
            { x: -1, y: 0, z: 0 },
            damage,
            0,
            0,
            DamageMod.UNKNOWN
        );

        expect(result?.psave).toBe(0); // No protection
        expect(result?.take).toBe(30);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50); // No cells used
        expect(target.health).toBe(70);
    });

    it('absorbs damage with power shield and consumes cells', () => {
        // Give power shield and cells
        pickupPowerArmor(target.client!.inventory, POWER_ARMOR_ITEMS['item_power_shield'], 0);
        addAmmo(target.client!.inventory.ammo, AmmoType.Cells, 50);

        const hitPoint = { x: 50, y: 0, z: 0 };
        const dir = { x: -1, y: 0, z: 0 };
        const damage = 30;

        const result = T_Damage(
            target,
            null,
            null,
            dir,
            hitPoint,
            { x: 1, y: 0, z: 0 },
            damage,
            0,
            0,
            DamageMod.UNKNOWN
        );

        expect(result?.psave).toBe(20);
        expect(result?.take).toBe(10);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(40);
        expect(target.health).toBe(90);
    });

    it('absorbs damage with power shield even from behind', () => {
        // Power shield protects all directions
        pickupPowerArmor(target.client!.inventory, POWER_ARMOR_ITEMS['item_power_shield'], 0);
        addAmmo(target.client!.inventory.ammo, AmmoType.Cells, 50);

        const hitPoint = { x: -50, y: 0, z: 0 }; // Behind
        const dir = { x: 1, y: 0, z: 0 };
        const damage = 30;

        const result = T_Damage(
            target,
            null,
            null,
            dir,
            hitPoint,
            { x: -1, y: 0, z: 0 },
            damage,
            0,
            0,
            DamageMod.UNKNOWN
        );

        expect(result?.psave).toBe(20);
        expect(result?.take).toBe(10);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(40);
        expect(target.health).toBe(90);
    });
});
