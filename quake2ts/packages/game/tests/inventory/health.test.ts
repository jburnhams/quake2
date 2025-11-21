// =================================================================
// Quake II - Health Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, canPickupHealth } from '../../src/inventory/index.js';
import { HEALTH_ITEMS } from '../../src/inventory/items.js';

describe('Health Pickups', () => {
    it('should be able to pick up health when below max', () => {
        const inventory = createPlayerInventory();
        const health = 50;
        const item = HEALTH_ITEMS['item_health'];
        const canPickup = canPickupHealth(inventory, health, item);
        expect(canPickup).toBe(true);
    });

    it('should not be able to pick up health when at max', () => {
        const inventory = createPlayerInventory();
        const health = 100;
        const item = HEALTH_ITEMS['item_health'];
        const canPickup = canPickupHealth(inventory, health, item);
        expect(canPickup).toBe(false);
    });

    it('should correctly calculate new health without exceeding max', () => {
        const inventory = createPlayerInventory();
        let health = 95;
        const item = HEALTH_ITEMS['item_health'];

        if (canPickupHealth(inventory, health, item)) {
            health += item.amount;
            if (health > item.max) {
                health = item.max;
            }
        }

        expect(health).toBe(100);
    });

    it('should correctly handle mega health pickup', () => {
        const inventory = createPlayerInventory();
        let health = 100;
        const item = HEALTH_ITEMS['item_health_mega'];

        if (canPickupHealth(inventory, health, item)) {
            health += item.amount;
            if (health > item.max) {
                health = item.max;
            }
        }

        expect(health).toBe(200);
    });
});
