// =================================================================
// Quake II - Armor Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, pickupArmor } from '../../src/inventory/index.js';
import { ARMOR_ITEMS } from '../../src/inventory/items.js';
import { ArmorType } from '../../src/combat/armor.js';

describe('Armor Pickups', () => {
    it('should add jacket armor to the player', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_jacket'];
        const pickedUp = pickupArmor(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.JACKET);
        expect(inventory.armor?.armorCount).toBe(25);
    });

    it('should add combat armor to the player', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_combat'];
        const pickedUp = pickupArmor(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.COMBAT);
        expect(inventory.armor?.armorCount).toBe(50);
    });

    it('should add body armor to the player', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_body'];
        const pickedUp = pickupArmor(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY);
        expect(inventory.armor?.armorCount).toBe(100);
    });

    it('should add armor shards to the player', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_jacket'];
        pickupArmor(inventory, item);
        const shard = ARMOR_ITEMS['item_armor_shard'];
        const pickedUp = pickupArmor(inventory, shard);
        expect(pickedUp).toBe(true);
        expect(inventory.armor?.armorCount).toBe(27);
    });

    it('should not exceed max armor', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_jacket'];
        pickupArmor(inventory, item);
        inventory.armor!.armorCount = 49;
        const pickedUp = pickupArmor(inventory, item);
        expect(pickedUp).toBe(true);
        expect(inventory.armor?.armorCount).toBe(50);
    });

    it('should not pickup armor shards if the player has no armor', () => {
        const inventory = createPlayerInventory();
        const item = ARMOR_ITEMS['item_armor_shard'];
        const pickedUp = pickupArmor(inventory, item);
        expect(pickedUp).toBe(false);
    });
});
