import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Entity, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { PlayerClient, createPlayerInventory, pickupPowerArmor } from '../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import { POWER_ARMOR_ITEMS } from '../../src/inventory/items.js';
import { AmmoType, addAmmo } from '../../src/inventory/ammo.js';

describe('T_Damage power armor integration', () => {
    let target: Entity;

    beforeEach(() => {
        target = new Entity(1);
        target.takedamage = true;
        target.health = 100;
        target.mass = 200;
        target.solid = Solid.Bsp;
        target.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
        };
    });

    it('absorbs damage with power screen and consumes cells', () => {
        // Give power screen and cells
        pickupPowerArmor(target.client!.inventory, POWER_ARMOR_ITEMS['item_power_screen'], 0);
        addAmmo(target.client!.inventory.ammo, AmmoType.Cells, 50);

        // Angle check: attacker must be in front.
        // Default target angles 0,0,0 (facing East).
        // Attacker at 100,0,0 (East of target) -> direction from attacker to target is West.
        // Wait, applyPowerArmor logic:
        // const toImpact = hitPoint - origin.
        // Screen protects front.
        // If hitPoint is in front of player, it protects.

        const hitPoint = { x: 50, y: 0, z: 0 }; // In front
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

        // Power Screen: 1/3 damage absorbed. 30/3 = 10 saved.
        // Cost: 10 cells.

        expect(result?.psave).toBe(10);
        expect(result?.take).toBe(20);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(40);
        expect(target.health).toBe(80);
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

        // Power Shield: 2/3 damage absorbed. 30 * 2/3 = 20 saved.
        // Cost: 20 cells * 2 = 40 cells?
        // Wait, applyPowerArmor logic for shield (ctfMode false):
        // damagePerCell = 2.
        // saved = 20.
        // powerUsed = saved / damagePerCell = 10 cells.

        expect(result?.psave).toBe(20);
        expect(result?.take).toBe(10);
        expect(target.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(40);
        expect(target.health).toBe(90);
    });
});
