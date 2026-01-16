// =================================================================
// Quake II - Super Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as damage from '../../../src/combat/damage.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Super Shotgun', () => {
    it('should consume 2 shells and fire 20 pellets', () => {
        const customTrace = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                trace: customTrace,
            },
        });
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        customTrace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(8);
        expect(customTrace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets
        // DamageFlags.BULLET (16), DamageMod.SSHOTGUN (3)
        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 6, 1, 16, 3, game.time, expect.any(Function), expect.objectContaining({ hooks: expect.anything() }));
    });

    it('should fire two volleys with horizontal spread', () => {
        const customTrace = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                trace: customTrace,
            },
        });
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 90, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        customTrace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(customTrace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets

        // Check the trace calls to verify the spread pattern
        const calls = customTrace.mock.calls;
        // calls[0] is source
        // 1-10 is first volley
        // 11-20 is second volley
        const firstVolleyDirections = calls.slice(1, 11).map(call => call[3].x);
        const secondVolleyDirections = calls.slice(11, 21).map(call => call[3].x);

        // Check that the two volleys are distinct
        const firstVolleyAverage = firstVolleyDirections.reduce((a, b) => a + b, 0) / firstVolleyDirections.length;
        const secondVolleyAverage = secondVolleyDirections.reduce((a, b) => a + b, 0) / secondVolleyDirections.length;

        // With a yaw of 90, the first volley (yaw 85) should have a positive x component,
        // and the second volley (yaw 95) should have a negative x component.
        expect(firstVolleyAverage).toBeGreaterThan(0);
        expect(secondVolleyAverage).toBeLessThan(0);
    });
});
