// =================================================================
// Quake II - Item Tests
// =================================================================

import { describe, expect, it } from 'vitest';
import { createPlayerInventory, pickupWeapon, WEAPON_ITEMS } from '../src/inventory';
import { WeaponId } from '../src/inventory/playerInventory';
import { AmmoType } from '../src/inventory/ammo';

describe('Item Pickup', () => {
    it('should give weapon and initial ammo on first pickup', () => {
        const inventory = createPlayerInventory();
        const shotgunItem = WEAPON_ITEMS['weapon_shotgun'];

        const isNew = pickupWeapon(inventory, shotgunItem);

        expect(isNew).toBe(true);
        expect(inventory.ownedWeapons.has(WeaponId.Shotgun)).toBe(true);
        expect(inventory.ammo.counts[AmmoType.Shells]).toBe(10);
        expect(inventory.currentWeapon).toBe(WeaponId.Shotgun);
    });

    it('should give ammo on subsequent pickups', () => {
        const inventory = createPlayerInventory({
            weapons: [WeaponId.Shotgun],
        });
        inventory.ammo.counts[AmmoType.Shells] = 5;
        const shotgunItem = WEAPON_ITEMS['weapon_shotgun'];

        const isNew = pickupWeapon(inventory, shotgunItem);

        expect(isNew).toBe(false);
        expect(inventory.ownedWeapons.has(WeaponId.Shotgun)).toBe(true);
        expect(inventory.ammo.counts[AmmoType.Shells]).toBe(15);
    });
});
