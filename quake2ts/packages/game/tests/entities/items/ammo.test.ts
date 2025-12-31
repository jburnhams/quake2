import { describe, it, expect, vi } from 'vitest';
import { createAmmoPickupEntity } from '../../../src/entities/items/ammo.js';
import { AmmoItemId, AmmoType } from '../../../src/inventory/ammo.js';
import { Solid } from '../../../src/entities/entity.js';
import { Entity } from '../../../src/entities/entity.js';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createMockGameExports } from '@quake2ts/test-utils/game/helpers';
import { createMockInventory } from '@quake2ts/test-utils';

describe('Ammo Pickup Entities', () => {
    const mockGame = createMockGameExports({
        sound: vi.fn(),
        centerprintf: vi.fn(),
        time: 100,
        deathmatch: true,
        entities: {
            scheduleThink: vi.fn()
        }
    });

    it('should create an ammo pickup entity', () => {
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells);
        expect(ammo.classname).toBe('ammo_shells');
        expect(ammo.solid).toBe(Solid.Trigger);
        expect(typeof ammo.touch).toBe('function');
    });

    it('should pickup ammo when touched by player', () => {
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells) as Entity;

        const inventory = createMockInventory();
        // Ensure starting shell count is 0 for clear assertion
        inventory.ammo.counts[AmmoType.Shells] = 0;

        const player = createPlayerEntityFactory({
            client: {
                inventory
            } as any
        }) as Entity;

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
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells) as Entity;

        const inventory = createMockInventory();
        // Set to max
        inventory.ammo.counts[AmmoType.Shells] = inventory.ammo.caps[AmmoType.Shells];
        const max = inventory.ammo.counts[AmmoType.Shells];

        const player = createPlayerEntityFactory({
            client: {
                inventory
            } as any
        }) as Entity;

        if (!ammo.touch) throw new Error('Touch callback undefined');

        // Reset mocks to ensure clean state
        vi.clearAllMocks();

        ammo.touch(ammo, player);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(max);
        expect(mockGame.sound).not.toHaveBeenCalled();
    });
});
