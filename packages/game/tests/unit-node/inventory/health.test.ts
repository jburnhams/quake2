// =================================================================
// Quake II - Health Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { canPickupHealth } from '../../../src/inventory/index.js';
import { HEALTH_ITEMS } from '../../../src/inventory/items.js';
import { createMockInventory } from '@quake2ts/test-utils';

describe('Health Pickups', () => {
    it('should be able to pick up health when below max', () => {
        const inventory = createMockInventory();
        const health = 50;
        const item = HEALTH_ITEMS['item_health'];
        const canPickup = canPickupHealth(inventory, health, item);
        expect(canPickup).toBe(true);
    });

    it('should not be able to pick up health when at max', () => {
        const inventory = createMockInventory();
        const health = 100;
        const item = HEALTH_ITEMS['item_health'];
        const canPickup = canPickupHealth(inventory, health, item);
        expect(canPickup).toBe(false);
    });

    it('should correctly calculate new health without exceeding max', () => {
        const inventory = createMockInventory();
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
        const inventory = createMockInventory();
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
