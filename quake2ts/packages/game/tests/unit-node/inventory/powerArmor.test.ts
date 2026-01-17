import { describe, expect, it } from 'vitest';
import {
  createPlayerInventory,
  pickupPowerArmor,
} from '../../../src/inventory/index.js';
import { POWER_ARMOR_ITEMS } from '../../../src/inventory/items.js';

describe('power armor', () => {
    it('picks up power screen', () => {
        const inventory = createPlayerInventory();
        const item = POWER_ARMOR_ITEMS['item_power_screen'];
        const pickedUp = pickupPowerArmor(inventory, item, 0);

        expect(pickedUp).toBe(true);
        expect(inventory.items.has(item.id)).toBe(true);
        expect(inventory.pickupItem).toBe('i_powerscreen');
    });

    it('picks up power shield', () => {
        const inventory = createPlayerInventory();
        const item = POWER_ARMOR_ITEMS['item_power_shield'];
        const pickedUp = pickupPowerArmor(inventory, item, 0);

        expect(pickedUp).toBe(true);
        expect(inventory.items.has(item.id)).toBe(true);
        expect(inventory.pickupItem).toBe('i_powershield');
    });

    it('does not pick up if already owned', () => {
        const inventory = createPlayerInventory();
        const item = POWER_ARMOR_ITEMS['item_power_screen'];

        pickupPowerArmor(inventory, item, 0);
        const pickedUpAgain = pickupPowerArmor(inventory, item, 10);

        expect(pickedUpAgain).toBe(false);
        // Should not update pickup time/icon if not picked up (false returned)
        // But the function setPickup is only called if returning true.
        expect(inventory.pickupTime).toBe(0);
    });
});
