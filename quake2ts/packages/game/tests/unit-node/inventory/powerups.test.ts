// =================================================================
// Quake II - Powerup Pickup Tests
// =================================================================

import { describe, it, expect } from 'vitest';
import { pickupPowerup, PlayerClient } from '../../../src/inventory/index.js';
import { PowerupId } from '../../../src/inventory/playerInventory.js';
import { createMockInventory, createMockPowerupItem } from '@quake2ts/test-utils';

describe('Powerup Pickups', () => {
    it('should add quad damage to the player', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_quad', 30000);
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.QuadDamage)).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(30000);
    });

    it('should add invulnerability to the player', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_invulnerability', 30000);
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Invulnerability)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Invulnerability)).toBe(30000);
    });

    it('should add silencer to the player', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_silencer', 30000);
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Silencer)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Silencer)).toBe(30000);
    });

    it('should add rebreather to the player', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_rebreather', 30000);
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.Rebreather)).toBe(true);
        expect(inventory.powerups.get(PowerupId.Rebreather)).toBe(30000);
    });

    it('should add enviro suit to the player', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_enviro', 30000);
        const pickedUp = pickupPowerup(client, item, 0);
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.has(PowerupId.EnviroSuit)).toBe(true);
        expect(inventory.powerups.get(PowerupId.EnviroSuit)).toBe(30000);
    });

    it('should extend the timer if the player already has the powerup', () => {
        const inventory = createMockInventory();
        const client = { inventory } as PlayerClient;
        const item = createMockPowerupItem('item_quad', 30000);
        pickupPowerup(client, item, 0); // Expires at 30000
        const pickedUp = pickupPowerup(client, item, 15000); // Pick up at 15000
        expect(pickedUp).toBe(true);
        expect(inventory.powerups.get(PowerupId.QuadDamage)).toBe(60000); // 30000 + 30000
    });
});
