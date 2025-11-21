// =================================================================
// Quake II - Health Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, pickupHealth } from '../../src/inventory/index.js';
import { HEALTH_ITEMS } from '../../src/inventory/items.js';

describe('Health Pickups', () => {
    it('should add health to the player', () => {
        const inventory = createPlayerInventory();
        const health = 50;
        const item = HEALTH_ITEMS['item_health'];
        const pickedUp = pickupHealth(inventory, health, item);
        expect(pickedUp).toBe(true);
    });

    it('should not add health if the player is at max health', () => {
        const inventory = createPlayerInventory();
        const health = 100;
        const item = HEALTH_ITEMS['item_health'];
        const pickedUp = pickupHealth(inventory, health, item);
        expect(pickedUp).toBe(false);
    });

    it('should not exceed max health', () => {
        const inventory = createPlayerInventory();
        let health = 95;
        const item = HEALTH_ITEMS['item_health'];
        const pickedUp = pickupHealth(inventory, health, item);
        expect(pickedUp).toBe(true);
        health += item.amount;
        if (health > item.max) {
            health = item.max;
        }
        expect(health).toBe(100);
    });

    it('should handle mega health correctly', () => {
        const inventory = createPlayerInventory();
        let health = 100;
        const item = HEALTH_ITEMS['item_health_mega'];
        const pickedUp = pickupHealth(inventory, health, item);
        expect(pickedUp).toBe(true);
        health += item.amount;
        if (health > item.max) {
            health = item.max;
        }
        expect(health).toBe(200);
    });
});
