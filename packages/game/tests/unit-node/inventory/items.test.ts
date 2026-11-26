// =================================================================
// Quake II - Item Tests
// =================================================================

import { describe, expect, it } from 'vitest';
import { pickupWeapon } from '../../../src/inventory/index.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import { createMockInventory, createMockWeaponItem } from '@quake2ts/test-utils';

describe('Item Pickup', () => {
    it('should give weapon and initial ammo on first pickup', () => {
        const inventory = createMockInventory();
        const shotgunItem = createMockWeaponItem(WeaponId.Shotgun);

        const isNew = pickupWeapon(inventory, shotgunItem, 0);

        expect(isNew).toBe(true);
        expect(inventory.ownedWeapons.has(WeaponId.Shotgun)).toBe(true);
        expect(inventory.ammo.counts[AmmoType.Shells]).toBe(10);
        expect(inventory.currentWeapon).toBe(WeaponId.Shotgun);
    });

    it('should give ammo on subsequent pickups', () => {
        const inventory = createMockInventory({
            ownedWeapons: new Set([WeaponId.Shotgun]),
        });
        inventory.ammo.counts[AmmoType.Shells] = 5;
        const shotgunItem = createMockWeaponItem(WeaponId.Shotgun);

        const isNew = pickupWeapon(inventory, shotgunItem, 0);

        expect(isNew).toBe(true);
        expect(inventory.ownedWeapons.has(WeaponId.Shotgun)).toBe(true);
        expect(inventory.ammo.counts[AmmoType.Shells]).toBe(15);
    });

    it('should not give ammo if already at max', () => {
        const inventory = createMockInventory({
            ownedWeapons: new Set([WeaponId.Shotgun]),
        });
        inventory.ammo.counts[AmmoType.Shells] = 100;
        const shotgunItem = createMockWeaponItem(WeaponId.Shotgun);

        const result = pickupWeapon(inventory, shotgunItem, 0);

        expect(result).toBe(false);
        expect(inventory.ammo.counts[AmmoType.Shells]).toBe(100);
    });
});
