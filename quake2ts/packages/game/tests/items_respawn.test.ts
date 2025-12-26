import { describe, it, expect, vi } from 'vitest';
import { createGame } from '../src/index.js';
import { createWeaponPickupEntity } from '../src/entities/items/weapons.js';
import { Solid } from '../src/entities/entity.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createMockWeaponItem, spawnEntity } from '@quake2ts/test-utils';
import { WeaponId } from '../src/inventory/playerInventory.js';

describe('Item Respawn Logic', () => {
    it('should NOT schedule respawn in Single Player mode', () => {
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false });

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = createMockWeaponItem(WeaponId.Shotgun);
        const pickup = game.entities.spawn();
        Object.assign(pickup, createWeaponPickupEntity(game, weaponItem));

        const player = spawnEntity(game.entities, createPlayerEntityFactory());

        // Simulate touch
        if (pickup.touch) {
            pickup.touch(pickup, player);
        }

        // Correct SP behavior: Respawns should NOT be scheduled.
        expect(scheduleThinkSpy).not.toHaveBeenCalled();
        // In SP, item is freed. Since free is deferred, we check freePending/inUse.
        expect(pickup.freePending).toBe(true);
    });

    it('should schedule respawn in Deathmatch mode', () => {
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });

        // Mock scheduleThink
        const scheduleThinkSpy = vi.spyOn(game.entities, 'scheduleThink');

        const weaponItem = createMockWeaponItem(WeaponId.Shotgun);
        const pickup = game.entities.spawn();
        Object.assign(pickup, createWeaponPickupEntity(game, weaponItem));

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
