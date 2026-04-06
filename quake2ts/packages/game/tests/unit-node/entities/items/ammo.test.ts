import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAmmoPickupEntity } from '../../../../src/entities/items/ammo.js';
import { AmmoItemId, AmmoType } from '../../../../src/inventory/ammo.js';
import { Solid } from '../../../../src/entities/entity.js';
import { Entity } from '../../../../src/entities/entity.js';
import { createPlayerEntityFactory, createTestGame, createMockInventory, createPlayerClientFactory } from '@quake2ts/test-utils';
import type { GameExports } from '../../../../src/index.js';

describe('Ammo Pickup Entities', () => {
    let mockGame: GameExports;

    beforeEach(() => {
        const { game } = createTestGame({ config: { deathmatch: true } });
        mockGame = game;
        vi.spyOn(mockGame, 'time', 'get').mockReturnValue(100);
        vi.spyOn(mockGame, 'sound');
        vi.spyOn(mockGame, 'centerprintf');
        vi.spyOn(mockGame.entities, 'scheduleThink');
    });

    it('should create an ammo pickup entity', () => {
        const ammo = createAmmoPickupEntity(mockGame, AmmoItemId.Shells);
        expect(ammo.classname).toBe('ammo_shells');
        expect(ammo.solid).toBe(Solid.Trigger);
        expect(typeof ammo.touch).toBe('function');
    });

    it('should pickup ammo when touched by player', () => {
        const ammo = createAmmoPickupEntity(mockGame, AmmoItemId.Shells);

        const inventory = createMockInventory();
        // Ensure starting shell count is 0 for clear assertion
        inventory.ammo.counts[AmmoType.Shells] = 0;

        const player = createPlayerEntityFactory({
            client: createPlayerClientFactory({
                inventory
            })
        });

        // Ensure touch is defined
        if (!ammo.touch) throw new Error('Touch callback undefined');

        ammo.touch(ammo, player);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(10); // default shell count
        expect(mockGame.sound).toHaveBeenCalled();
        expect(mockGame.centerprintf).toHaveBeenCalledWith(player, 'You got 10 Shells');
        expect(ammo.solid).toBe(Solid.Not);
        expect(ammo.nextthink).toBe(130);
    });

    it('should not pickup if maxed out', () => {
        const ammo = createAmmoPickupEntity(mockGame, AmmoItemId.Shells);

        const inventory = createMockInventory();
        // Set to max
        inventory.ammo.counts[AmmoType.Shells] = inventory.ammo.caps[AmmoType.Shells];
        const max = inventory.ammo.counts[AmmoType.Shells];

        const player = createPlayerEntityFactory({
            client: createPlayerClientFactory({
                inventory
            })
        });

        if (!ammo.touch) throw new Error('Touch callback undefined');

        // Reset mocks to ensure clean state
        vi.clearAllMocks();

        ammo.touch(ammo, player);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(max);
        expect(mockGame.sound).not.toHaveBeenCalled();
    });
});
