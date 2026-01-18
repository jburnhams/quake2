import { describe, it, expect, vi } from 'vitest';
import { createWeaponPickupEntity } from '../src/entities/items/weapons.js';
import { WEAPON_ITEMS } from '../src/inventory/items.js';
import { Solid } from '../src/entities/entity.js';
import { createTestGame, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Item Respawn Logic', () => {
    it('should NOT schedule respawn in Single Player mode', () => {
        const { game } = createTestGame({
            config: { deathmatch: false }
        });

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = WEAPON_ITEMS['weapon_shotgun'];
        // Spawn the weapon pickup using standard game logic helpers
        const pickup = spawnEntity(game.entities, createWeaponPickupEntity(game, weaponItem));

        const player = spawnEntity(game.entities, createPlayerEntityFactory());

        // Simulate touch
        if (pickup.touch) {
            pickup.touch(pickup, player);
        }

        // Correct SP behavior: Respawns should NOT be scheduled.
        expect(scheduleThinkSpy).not.toHaveBeenCalled();
        // In SP, item is freed.
        expect(pickup.freePending).toBe(true);
    });

    it('should schedule respawn in Deathmatch mode', () => {
        const { game } = createTestGame({
            config: { deathmatch: true }
        });

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = WEAPON_ITEMS['weapon_shotgun'];
        const pickup = spawnEntity(game.entities, createWeaponPickupEntity(game, weaponItem));

        const player = spawnEntity(game.entities, createPlayerEntityFactory());

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
