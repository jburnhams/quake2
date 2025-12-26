// =================================================================
// Quake II - Railgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { createPlayerWeaponStates } from '../../src/combat/weapons/state.js';
import { createTestContext, createPlayerEntityFactory, spawnEntity, createGameImportsAndEngine } from '@quake2ts/test-utils';
import { createGame } from '../../src/index.js';

describe('Railgun', () => {
    // Setup helper to create a game context
    const setupGame = (isDeathmatch: boolean) => {
        // Manually create context for DM flag control
        const { imports, engine } = createGameImportsAndEngine({
            imports: {
                trace: vi.fn().mockImplementation((start, mins, maxs, end) => {
                     // Simulate hitting an entity at some distance
                     const dist = 100;
                     const dir = { x: 1, y: 0, z: 0 };
                     return {
                         fraction: 0.5,
                         endpos: { x: start.x + dir.x * dist, y: start.y, z: start.z },
                         allsolid: false,
                         startsolid: false,
                         ent: { takedamage: true, origin: {x: 100, y: 0, z: 0} } // Mock entity
                     };
                }),
            },
        });
        const game = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: isDeathmatch });

        // Mock T_Damage
        const tDamageSpy = vi.spyOn(damage, 'T_Damage').mockImplementation(() => {});

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            classname: 'player',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            viewheight: 22
        }));

        if (!player.client) player.client = {} as any;
        Object.assign(player.client!, {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Railgun],
                ammo: { [AmmoType.Slugs]: 10 },
            }),
            weaponStates: createPlayerWeaponStates(),
            kick_angles: ZERO_VEC3,
            kick_origin: ZERO_VEC3,
        });

        return { game, player, trace: imports.trace, tDamageSpy };
    };

    it('should deal correct damage and kick in Deathmatch', () => {
        const { game, player, tDamageSpy } = setupGame(true); // DM = true

        fire(game, player, WeaponId.Railgun);

        expect(tDamageSpy).toHaveBeenCalledWith(
            expect.anything(), // target
            player,            // inflictor
            player,            // attacker
            expect.anything(), // dir
            expect.anything(), // point
            expect.anything(), // normal
            100,               // damage (DM)
            200,               // kick (DM)
            expect.anything(), // damageFlags
            DamageMod.RAILGUN,
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });

    it('should deal correct damage and kick in Single Player', () => {
        const { game, player, tDamageSpy } = setupGame(false); // DM = false

        fire(game, player, WeaponId.Railgun);

        expect(tDamageSpy).toHaveBeenCalledWith(
            expect.anything(), // target
            player,            // inflictor
            player,            // attacker
            expect.anything(), // dir
            expect.anything(), // point
            expect.anything(), // normal
            125,               // damage (SP)
            225,               // kick (SP)
            expect.anything(), // damageFlags
            DamageMod.RAILGUN,
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });
});
