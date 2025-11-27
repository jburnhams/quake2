// =================================================================
// Quake II - Powerup Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { createPlayerInventory, pickupPowerup, PlayerClient } from '../../src/inventory/index.js';
import { POWERUP_ITEMS } from '../../src/inventory/items.js';
import { PowerupId } from '../../src/inventory/playerInventory.js';

describe('Powerup Pickups', () => {
    it('should add quad damage to the player', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_quad'];
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.QuadDamage)).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(30000);
    });

    it('should add invulnerability to the player', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_invulnerability'];
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Invulnerability)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Invulnerability)).toBe(30000);
    });

    it('should add silencer to the player', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_silencer'];
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Silencer)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Silencer)).toBe(30000);
    });

    it('should add rebreather to the player', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_rebreather'];
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Rebreather)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Rebreather)).toBe(30000);
    });

    it('should add enviro suit to the player', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_enviro'];
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.EnviroSuit)).toBe(true);
        expect(inventory.powerups.get(PowerupId.EnviroSuit)).toBe(30000);
    });

    it('should extend the timer if the player already has the powerup', () => {
        const inventory = createPlayerInventory();
        const client = { inventory } as PlayerClient;
        const item = POWERUP_ITEMS['item_quad'];
        pickupPowerup(client, item, 0); // Expires at 30000
        const pickedUp = pickupPowerup(client, item, 15000); // Pick up at 15000
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(60000); // 30000 + 30000
    });
});
