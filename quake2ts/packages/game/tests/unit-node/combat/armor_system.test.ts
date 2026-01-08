import { describe, it, expect, vi } from 'vitest';
import { applyPowerArmor, applyRegularArmor, ARMOR_INFO, ArmorType } from '../../src/combat/armor.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { createPlayerInventory, pickupArmor } from '../../src/inventory/playerInventory.js';
import { ArmorItem } from '../../src/inventory/items.js';
import { createPowerArmorState } from '@quake2ts/test-utils';

describe('Armor System', () => {
    describe('Power Armor', () => {
        const origin = { x: 0, y: 0, z: 0 };
        const angles = { x: 0, y: 0, z: 0 };

        const makeState = (type: 'screen' | 'shield', cells: number) => createPowerArmorState({
            type,
            cellCount: cells,
            origin,
            angles,
            health: 100
        });

        it('Power Screen protects from front', () => {
            const state = makeState('screen', 100);
            const hitPoint = { x: 100, y: 0, z: 0 }; // In front (+X)
            const result = applyPowerArmor(30, 0, hitPoint, { x: -1, y: 0, z: 0 }, state);

            // Should save damage (1/3 for screen)
            expect(result.saved).toBeGreaterThan(0);
            expect(result.saved).toBe(10); // 30 / 3 = 10
            expect(result.remainingCells).toBeLessThan(100);
        });

        it('Power Screen fails from back', () => {
            const state = makeState('screen', 100);
            const hitPoint = { x: -100, y: 0, z: 0 }; // Behind (-X)
            const result = applyPowerArmor(30, 0, hitPoint, { x: 1, y: 0, z: 0 }, state);

            expect(result.saved).toBe(0);
            expect(result.remainingCells).toBe(100);
        });

        it('Power Shield protects from all directions', () => {
            const state = makeState('shield', 100);
            const hitPoint = { x: -100, y: 0, z: 0 }; // Behind
            const result = applyPowerArmor(30, 0, hitPoint, { x: 1, y: 0, z: 0 }, state);

            // Should save damage (2/3 for shield)
            expect(result.saved).toBeGreaterThan(0);
            expect(result.saved).toBe(20); // 30 * 2/3 = 20
            expect(result.remainingCells).toBeLessThan(100);
        });

        it('Consumes cells correctly', () => {
            const state = makeState('screen', 100);
            const hitPoint = { x: 100, y: 0, z: 0 };
            // Screen takes 1 cell per point of damage absorbed?
            // Code says: damagePerCell = 1 (screen), 2 (shield, non-ctf)
            // powerUsed = saved / damagePerCell

            const result = applyPowerArmor(30, 0, hitPoint, { x: -1, y: 0, z: 0 }, state);
            // Saved = 10. damagePerCell = 1. Used = 10.
            expect(result.remainingCells).toBe(90);
        });

        it('Stops protecting if out of cells', () => {
             const state = makeState('screen', 0);
             const hitPoint = { x: 100, y: 0, z: 0 };
             const result = applyPowerArmor(30, 0, hitPoint, { x: -1, y: 0, z: 0 }, state);
             expect(result.saved).toBe(0);
        });
    });

    describe('Regular Armor Pickup Logic', () => {
        const jacketItem: ArmorItem = { id: 'item_armor_jacket', amount: 25, model: '', pickupSound: '', icon: '' };
        const combatItem: ArmorItem = { id: 'item_armor_combat', amount: 50, model: '', pickupSound: '', icon: '' };
        const bodyItem: ArmorItem = { id: 'item_armor_body', amount: 100, model: '', pickupSound: '', icon: '' };
        const shardItem: ArmorItem = { id: 'item_armor_shard', amount: 2, model: '', pickupSound: '', icon: '' };

        it('Picks up better armor', () => {
            const inv = createPlayerInventory();
            inv.armor = { armorType: ArmorType.JACKET, armorCount: 20 };

            const picked = pickupArmor(inv, combatItem, 0);
            expect(picked).toBe(true);
            expect(inv.armor?.armorType).toBe(ArmorType.COMBAT);
            expect(inv.armor?.armorCount).toBe(50);
        });

        it('Ignores weaker armor', () => {
            const inv = createPlayerInventory();
            inv.armor = { armorType: ArmorType.BODY, armorCount: 100 }; // 0.8 protection

            const picked = pickupArmor(inv, combatItem, 0); // 0.6 protection
            expect(picked).toBe(false);
            expect(inv.armor?.armorType).toBe(ArmorType.BODY);
        });

        it('Replenishes same armor type up to max', () => {
            const inv = createPlayerInventory();
            inv.armor = { armorType: ArmorType.JACKET, armorCount: 10 };

            const picked = pickupArmor(inv, jacketItem, 0);
            expect(picked).toBe(true);
            expect(inv.armor?.armorCount).toBe(35); // 10 + 25
        });

        it('Caps armor at max count', () => {
            const inv = createPlayerInventory();
            inv.armor = { armorType: ArmorType.JACKET, armorCount: 40 }; // Max is 50

            const picked = pickupArmor(inv, jacketItem, 0); // +25
            expect(picked).toBe(true);
            expect(inv.armor?.armorCount).toBe(50);
        });

        it('Shards accumulate correctly', () => {
            const inv = createPlayerInventory();
            inv.armor = { armorType: ArmorType.JACKET, armorCount: 48 };

            pickupArmor(inv, shardItem, 0); // +2
            expect(inv.armor?.armorCount).toBe(50);

            pickupArmor(inv, shardItem, 0); // +2, over max?
            // Logic says if (count > max) count = max.
            // So currently it caps.
            expect(inv.armor?.armorCount).toBe(50);
        });

        it('Shards grant Jacket armor if none present', () => {
             const inv = createPlayerInventory();
             expect(inv.armor).toBeNull();
             pickupArmor(inv, shardItem, 0);
             expect(inv.armor?.armorType).toBe(ArmorType.JACKET);
             expect(inv.armor?.armorCount).toBe(2);
        });
    });
});
