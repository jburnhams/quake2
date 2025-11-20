// =================================================================
// Quake II - Weapon Pickup Entity Tests
// =================================================================

import { describe, expect, it, vi } from 'vitest';
import { createWeaponPickupEntity } from '../../../src/entities/items';
import { WEAPON_ITEMS } from '../../../src/inventory';
import { Entity } from '../../../src/entities';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/playerInventory';
import { AmmoType } from '../../../src/inventory/ammo';
import { GameExports } from '../../../src';

import { beforeEach } from 'vitest';

describe('Weapon Pickup Entities', () => {
    let mockGame: GameExports;

    beforeEach(() => {
        mockGame = {
            sound: vi.fn(),
            addUFFlags: vi.fn(),
        } as unknown as GameExports;
    });

    it('should create a weapon pickup entity with a touch function', () => {
        const shotgunItem = WEAPON_ITEMS['weapon_shotgun'];
        const entity = createWeaponPickupEntity(mockGame, shotgunItem);

        expect(entity.classname).toBe('weapon_shotgun');
        expect(entity.touch).toBeDefined();
    });

    it('should call pickupWeapon when touched by a player', () => {
        const shotgunItem = WEAPON_ITEMS['weapon_shotgun'];
        const entity = createWeaponPickupEntity(mockGame, shotgunItem) as Entity;

        const player = {
            client: {
                inventory: createPlayerInventory(),
            },
        } as Entity;

        entity.touch(entity, player);

        expect(player.client.inventory.ownedWeapons.has(WeaponId.Shotgun)).toBe(true);
        expect(player.client.inventory.ammo.counts[AmmoType.Shells]).toBe(10);
        expect(mockGame.sound).toHaveBeenCalledWith(player, 0, 'items/pkup.wav', 1, 1, 0);
        expect(mockGame.addUFFlags).toHaveBeenCalledWith(entity, -1);
    });

    it('should not do anything when touched by a non-player', () => {
        const shotgunItem = WEAPON_ITEMS['weapon_shotgun'];
        const entity = createWeaponPickupEntity(mockGame, shotgunItem) as Entity;

        const nonPlayer = {} as Entity;

        entity.touch(entity, nonPlayer);

        expect(mockGame.sound).not.toHaveBeenCalled();
        expect(mockGame.addUFFlags).not.toHaveBeenCalled();
    });
});
