// =================================================================
// Quake II - Key Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, pickupKey } from '../../../src/inventory/index.js';
import { KEY_ITEMS } from '../../../src/inventory/items.js';
import { KeyId } from '../../../src/inventory/playerInventory.js';

describe('Key Pickups', () => {
    it('should add the blue key to the player', () => {
        const inventory = createPlayerInventory();
        const item = KEY_ITEMS['key_blue'];
        const pickedUp = pickupKey(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.keys.has(KeyId.Blue)).toBe(true);
    });

    it('should add the red key to the player', () => {
        const inventory = createPlayerInventory();
        const item = KEY_ITEMS['key_red'];
        const pickedUp = pickupKey(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.keys.has(KeyId.Red)).toBe(true);
    });

    it('should add the green key to the player', () => {
        const inventory = createPlayerInventory();
        const item = KEY_ITEMS['key_green'];
        const pickedUp = pickupKey(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.keys.has(KeyId.Green)).toBe(true);
    });

    it('should add the yellow key to the player', () => {
        const inventory = createPlayerInventory();
        const item = KEY_ITEMS['key_yellow'];
        const pickedUp = pickupKey(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.keys.has(KeyId.Yellow)).toBe(true);
    });

    it('should not add the key if the player already has it', () => {
        const inventory = createPlayerInventory();
        const item = KEY_ITEMS['key_blue'];
        pickupKey(inventory, item);
        const pickedUp = pickupKey(inventory, item);
        expect(pickedUp).toBe(false);
    });
});
