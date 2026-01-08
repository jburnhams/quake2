import { describe, expect, it } from 'vitest';
import { ArmorType } from '../../src/combat/armor.js';
import { ARMOR_ITEMS } from '../../src/inventory/items.js';
import { createPlayerInventory, pickupArmor } from '../../src/inventory/playerInventory.js';

describe('Armor Pickup Logic', () => {
    it('grants Jacket Armor (2) when picking up a shard with no armor', () => {
        const inventory = createPlayerInventory();
        const shard = ARMOR_ITEMS['item_armor_shard'];
        const time = 1000;

        const result = pickupArmor(inventory, shard, time);

        expect(result).toBe(true);
        expect(inventory.armor).not.toBeNull();
        expect(inventory.armor?.armorType).toBe(ArmorType.JACKET);
        expect(inventory.armor?.armorCount).toBe(2);
    });

    it('adds to existing armor when picking up a shard', () => {
        const inventory = createPlayerInventory();
        const bodyArmor = ARMOR_ITEMS['item_armor_body'];
        const shard = ARMOR_ITEMS['item_armor_shard'];
        const time = 1000;

        pickupArmor(inventory, bodyArmor, time); // Set initial armor
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY);
        expect(inventory.armor?.armorCount).toBe(100);

        const result = pickupArmor(inventory, shard, time);

        expect(result).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY); // Should stay Body Armor
        expect(inventory.armor?.armorCount).toBe(102);
    });

    it('replaces weaker armor with stronger armor (Jacket -> Body)', () => {
        const inventory = createPlayerInventory();
        const jacket = ARMOR_ITEMS['item_armor_jacket'];
        const body = ARMOR_ITEMS['item_armor_body'];
        const time = 1000;

        pickupArmor(inventory, jacket, time);
        expect(inventory.armor?.armorType).toBe(ArmorType.JACKET);

        const result = pickupArmor(inventory, body, time);

        expect(result).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY);
        expect(inventory.armor?.armorCount).toBe(100);
    });

    it('does NOT replace stronger armor with weaker armor (Body -> Jacket)', () => {
        const inventory = createPlayerInventory();
        const body = ARMOR_ITEMS['item_armor_body'];
        const jacket = ARMOR_ITEMS['item_armor_jacket'];
        const time = 1000;

        pickupArmor(inventory, body, time);
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY);

        const result = pickupArmor(inventory, jacket, time);

        expect(result).toBe(false); // Should not pick up
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY); // Should remain Body
        expect(inventory.armor?.armorCount).toBe(100); // Should not change
    });

    it('does NOT replace stronger armor with weaker armor (Combat -> Jacket)', () => {
        const inventory = createPlayerInventory();
        const combat = ARMOR_ITEMS['item_armor_combat'];
        const jacket = ARMOR_ITEMS['item_armor_jacket'];
        const time = 1000;

        pickupArmor(inventory, combat, time);
        expect(inventory.armor?.armorType).toBe(ArmorType.COMBAT);

        const result = pickupArmor(inventory, jacket, time);

        expect(result).toBe(false);
        expect(inventory.armor?.armorType).toBe(ArmorType.COMBAT);
    });

    it('replaces weaker armor with stronger armor (Combat -> Body)', () => {
        const inventory = createPlayerInventory();
        const combat = ARMOR_ITEMS['item_armor_combat'];
        const body = ARMOR_ITEMS['item_armor_body'];
        const time = 1000;

        pickupArmor(inventory, combat, time);
        expect(inventory.armor?.armorType).toBe(ArmorType.COMBAT);

        const result = pickupArmor(inventory, body, time);

        expect(result).toBe(true);
        expect(inventory.armor?.armorType).toBe(ArmorType.BODY);
    });
});
