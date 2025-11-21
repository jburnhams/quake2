// =================================================================
// Quake II - Powerup Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, pickupPowerup } from '../../src/inventory/index.js';
import { POWERUP_ITEMS } from '../../src/inventory/items.js';
import { PowerupId } from '../../src/inventory/playerInventory.js';

describe('Powerup Pickups', () => {
    it('should add quad damage to the player', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_quad'];
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.QuadDamage)).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(30);
    });

    it('should add invulnerability to the player', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_invulnerability'];
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Invulnerability)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Invulnerability)).toBe(30);
    });

    it('should add silencer to the player', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_silencer'];
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Silencer)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Silencer)).toBe(30);
    });

    it('should add rebreather to the player', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_rebreather'];
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Rebreather)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Rebreather)).toBe(30);
    });

    it('should add enviro suit to the player', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_enviro'];
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.EnviroSuit)).toBe(true);
        expect(inventory.powerups.get(PowerupId.EnviroSuit)).toBe(30);
    });

    it('should refresh the timer if the player already has the powerup', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_quad'];
        pickupPowerup(inventory, item, 0);
        const pickedUp = pickupPowerup(inventory, item, 15);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(45);
    });

    it('should not refresh the timer if the player has more time remaining', () => {
        const inventory = createPlayerInventory();
        const item = POWERUP_ITEMS['item_quad'];
        pickupPowerup(inventory, item, 0);
        const pickedUp = pickupPowerup(inventory, item, 0);
        expect(pickedUp).toBe(false);
    });
});
