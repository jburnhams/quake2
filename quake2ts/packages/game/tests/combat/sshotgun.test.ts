// =================================================================
// Quake II - Super Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Super Shotgun', () => {
    it('should consume 2 shells and fire 20 pellets', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        spawnEntity(entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        }));

        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        expect(player).toBeDefined();

        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = spawnEntity(entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
            fraction: 0.1,
            startsolid: false,
            allsolid: false
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(8);
        expect(imports.trace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets

        // DamageFlags.BULLET (16), DamageMod.SSHOTGUN (3)
        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 6, 1, 16, 3, expect.anything(), expect.anything(), expect.anything());
    });

    it('should fire two volleys with horizontal spread', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        spawnEntity(entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 90, z: 0 }
        }));

        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        expect(player).toBeDefined();

        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = spawnEntity(entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
            fraction: 0.1,
            startsolid: false,
            allsolid: false
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(imports.trace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets

        // Check the trace calls to verify the spread pattern
        const calls = imports.trace.mock.calls;
        // calls[0] is source
        // 1-10 is first volley
        // 11-20 is second volley
        const firstVolleyDirections = calls.slice(1, 11).map(call => call[3].x);
        const secondVolleyDirections = calls.slice(11, 21).map(call => call[3].x);

        // Check that the two volleys are distinct
        const firstVolleyAverage = firstVolleyDirections.reduce((a: number, b: number) => a + b, 0) / firstVolleyDirections.length;
        const secondVolleyAverage = secondVolleyDirections.reduce((a: number, b: number) => a + b, 0) / secondVolleyDirections.length;

        // With a yaw of 90 (facing Y), the first volley (yaw 85, spread to right) should be skewed.
        // Wait, yaw 90 faces Y+.
        // angleVectors(0, 90, 0) -> Forward (0, 1, 0), Right (-1, 0, 0), Up (0, 0, 1)
        // Volley 1: yaw 90 - 5 = 85. Forward ~ (0.08, 0.99, 0).
        // Volley 2: yaw 90 + 5 = 95. Forward ~ (-0.08, 0.99, 0).

        // So first volley x is positive (0.08).
        // Second volley x is negative (-0.08).

        expect(firstVolleyAverage).toBeGreaterThan(0);
        expect(secondVolleyAverage).toBeLessThan(0);
    });
});
