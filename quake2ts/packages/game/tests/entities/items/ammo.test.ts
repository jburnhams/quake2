import { describe, it, expect, vi } from 'vitest';
import { createAmmoPickupEntity } from '../../../src/entities/items/ammo.js';
import { AmmoItemId } from '../../../src/inventory/ammo.js';
import { Solid } from '../../../src/entities/entity.js';
import { Entity } from '../../../src/entities/entity.js';

describe('Ammo Pickup Entities', () => {
    const mockGame = {
        sound: vi.fn(),
        centerprintf: vi.fn(),
        time: 100,
        entities: {
            scheduleThink: vi.fn()
        }
    };

    it('should create an ammo pickup entity', () => {
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells);
        expect(ammo.classname).toBe('ammo_shells');
        expect(ammo.solid).toBe(Solid.Trigger);
        expect(typeof ammo.touch).toBe('function');
    });

    it('should pickup ammo when touched by player', () => {
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells) as Entity;
        const player = {
            client: {
                inventory: {
                    ammo: {
                        caps: [100, 100], // shells is index 1
                        counts: [0, 0]
                    }
                }
            }
        } as any;

        // Ensure touch is defined
        if (!ammo.touch) throw new Error('Touch callback undefined');

        ammo.touch(ammo, player);

        expect(player.client.inventory.ammo.counts[1]).toBe(10); // default shell count
        expect(mockGame.sound).toHaveBeenCalled();
        expect(mockGame.centerprintf).toHaveBeenCalledWith(player, 'You got 10 shells');
        expect(ammo.solid).toBe(Solid.Not);
        expect(ammo.nextthink).toBe(130);
    });

    it('should not pickup if maxed out', () => {
        const ammo = createAmmoPickupEntity(mockGame as any, AmmoItemId.Shells) as Entity;
         const player = {
            client: {
                inventory: {
                    ammo: {
                        caps: [100, 100],
                        counts: [0, 100] // already max
                    }
                }
            }
        } as any;

        if (!ammo.touch) throw new Error('Touch callback undefined');

        // Reset mocks to ensure clean state
        vi.clearAllMocks();

        ammo.touch(ammo, player);

        expect(player.client.inventory.ammo.counts[1]).toBe(100);
        expect(mockGame.sound).not.toHaveBeenCalled();
    });
});
