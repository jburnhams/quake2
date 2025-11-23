import { describe, it, expect, vi } from 'vitest';
import { createGame } from '../src/index.js';
import { createWeaponPickupEntity } from '../src/entities/items/weapons.js';
import { WEAPON_ITEMS } from '../src/inventory/items.js';
import { Entity, Solid } from '../src/entities/entity.js';
import { createPlayerInventory } from '../src/inventory/playerInventory.js';

describe('Item Respawn Logic', () => {
    const trace = vi.fn();
    const pointcontents = vi.fn();
    const linkentity = vi.fn();
    const multicast = vi.fn();
    const unicast = vi.fn();
    const engine = {
        trace: vi.fn(),
        sound: vi.fn(),
        centerprintf: vi.fn(),
    };
    const optionsSP = { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false };
    const optionsDM = { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true };

    it('should NOT schedule respawn in Single Player mode', () => {
        const game = createGame({ trace, pointcontents, linkentity, multicast, unicast }, engine, optionsSP);

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = WEAPON_ITEMS['weapon_shotgun'];
        const pickup = game.entities.spawn();
        Object.assign(pickup, createWeaponPickupEntity(game, weaponItem));

        const player = game.entities.spawn();
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: {
                currentWeapon: null,
                lastFireTime: 0,
                weaponFrame: 0,
                weaponIdleTime: 0,
                weapons: {},
                activeWeaponId: null
            }
        };

        // Simulate touch
        if (pickup.touch) {
            pickup.touch(pickup, player);
        }

        // Correct SP behavior: Respawns should NOT be scheduled.
        expect(scheduleThinkSpy).not.toHaveBeenCalled();
        expect(pickup.solid).toBe(Solid.Not);
    });

    it('should schedule respawn in Deathmatch mode', () => {
        const game = createGame({ trace, pointcontents, linkentity, multicast, unicast }, engine, optionsDM);

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = WEAPON_ITEMS['weapon_shotgun'];
        const pickup = game.entities.spawn();
        Object.assign(pickup, createWeaponPickupEntity(game, weaponItem));

        const player = game.entities.spawn();
        player.client = {
            inventory: createPlayerInventory(),
            weaponStates: {
                currentWeapon: null,
                lastFireTime: 0,
                weaponFrame: 0,
                weaponIdleTime: 0,
                weapons: {},
                activeWeaponId: null
            }
        };

        // Simulate touch
        if (pickup.touch) {
            pickup.touch(pickup, player);
        }

        // Correct DM behavior: Respawns SHOULD be scheduled.
        expect(scheduleThinkSpy).toHaveBeenCalled();
        expect(pickup.solid).toBe(Solid.Not);
        expect(pickup.nextthink).toBeGreaterThan(game.time);
    });
});
