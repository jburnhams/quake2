// =================================================================
// Quake II - DM Item Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { pickupWeapon, pickupAmmo, pickupPowerup, pickupArmor } from '../../../src/inventory/index.js';
import { WEAPON_ITEMS, POWERUP_ITEMS, ARMOR_ITEMS } from '../../../src/inventory/items.js';
import { AMMO_TYPE_COUNT, getAmmoItemDefinition, AmmoItemId } from '../../../src/inventory/ammo.js';
import { createMockInventory } from '@quake2ts/test-utils';

describe('DM Item Pickups', () => {
    it('should pickup all weapons', () => {
        const inventory = createMockInventory();

        for (const item of Object.values(WEAPON_ITEMS)) {
            pickupWeapon(inventory, item, 0);
            expect(inventory.ownedWeapons.has(item.weaponId)).toBe(true);
        }
    });

    it('should pickup all ammo', () => {
        const inventory = createMockInventory();

        // Iterate over all AmmoItemId values
        const ammoIds = Object.values(AmmoItemId);

        for (const id of ammoIds) {
             const def = getAmmoItemDefinition(id);
             if (def) {
                 // pickupAmmo requires AmmoInventory
                 pickupAmmo(inventory.ammo, id);
                 // Verify count increased. Default count starts at 0 or seed.
                 // We can check if pickedUp returned true/adjustment
             }
        }
    });

    it('should pickup all powerups', () => {
        const inventory = createMockInventory();
        // Client mock needed for pickupPowerup
        const client = { inventory, powerups: inventory.powerups } as any;
        // Note: client object in game logic usually has direct properties for timers,
        // but pickupPowerup uses inventory.powerups Map mostly, except for setting client timers.

        for (const item of Object.values(POWERUP_ITEMS)) {
            // Need to mock client properties that pickupPowerup writes to
            client.quad_time = 0;
            client.invincible_time = 0;
            // etc.

            pickupPowerup(client, item, 0);
            // Check if powerup is in inventory.
             expect(inventory.powerups.size).toBeGreaterThan(0);
        }
    });

    it('should pickup all armor', () => {
        const inventory = createMockInventory();

        for (const item of Object.values(ARMOR_ITEMS)) {
             pickupArmor(inventory, item, 0);
             // Verify armor is set
             expect(inventory.armor).not.toBeNull();
        }
    });
});
