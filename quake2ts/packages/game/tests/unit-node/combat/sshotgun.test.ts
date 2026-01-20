// =================================================================
// Quake II - Super Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as damage from '../../../src/combat/damage.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createEntityFactory, createTraceMock } from '@quake2ts/test-utils';

describe('Super Shotgun', () => {
    it('should consume 2 shells and fire 20 pellets', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { game, imports } = createTestGame();
        const customTrace = imports.trace;

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        }));

        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = spawnEntity(game.entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        customTrace.mockReturnValue(createTraceMock({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
        }));

        fire(game, player, WeaponId.SuperShotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(8);
        expect(customTrace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets
        // DamageFlags.BULLET (16), DamageMod.SSHOTGUN (3)
        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 6, 1, 16, 3, 0, expect.any(Function), expect.objectContaining({ hooks: expect.anything() }));
    });

    it('should fire two volleys with horizontal spread', () => {
        const { game, imports } = createTestGame();
        const customTrace = imports.trace;

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            angles: { x: 0, y: 90, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        }));

        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = spawnEntity(game.entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        customTrace.mockReturnValue(createTraceMock({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
        }));

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
        // With a yaw of 90, the forward vector is +Y.
        // First volley (yaw 85) should be pointing slightly +X from +Y?
        // Wait:
        // angle 90 = Y+
        // angle 0 = X+
        // Left is +90 deg relative to forward?
        // The test was checking >0 and <0 for X.

        // Let's verify expectations:
        // Angle 90 is looking along Y axis.
        // Right is X+, Left is X-.

        // Quake angles: 0=East(X+), 90=North(Y+), 180=West(X-), 270=South(Y-)

        // First volley: yaw - 5 = 85 degrees.
        // cos(85) = +0.087 (X component) -> POSITIVE X

        // Second volley: yaw + 5 = 95 degrees.
        // cos(95) = -0.087 (X component) -> NEGATIVE X

        const firstVolleyAverage = firstVolleyDirections.reduce((a, b) => a + b, 0) / firstVolleyDirections.length;
        const secondVolleyAverage = secondVolleyDirections.reduce((a, b) => a + b, 0) / secondVolleyDirections.length;

        expect(firstVolleyAverage).toBeGreaterThan(0);
        expect(secondVolleyAverage).toBeLessThan(0);
    });
});
