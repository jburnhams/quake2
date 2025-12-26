// =================================================================
// Quake II - Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createTestContext, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Shotgun', () => {
    it('should consume 1 shell and fire 12 pellets', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        // Use factory for playerStart
        // Note: spawnEntity calls finalizeSpawn, which links the entity.
        const start = spawnEntity(entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 90, z: 0 }
        }));

        // spawnWorld checks for info_player_start to spawn a player in Single Player mode (which is default)
        game.spawnWorld();

        // spawnWorld spawns a player and puts it in the game.
        // We need to find it.
        const player = entities.find(e => e.classname === 'player');

        expect(player).toBeDefined();
        if (!player) throw new Error("Player not found");

        // Ensure inventory exists and set it up
        if (!player.client) {
             player.client = {} as any;
        }
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Shotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        // Use factory for target
        const target = spawnEntity(entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        // Mock hit at close range (10 units)
        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 0, y: 10, z: 0 },
            plane: { normal: { x: 0, y: -1, z: 0 }, dist: 0 },
            fraction: 0.1,
            startsolid: false,
            allsolid: false
        });

        fire(game, player, WeaponId.Shotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(9);
        expect(imports.trace).toHaveBeenCalledTimes(13); // 1 for P_ProjectSource + 12 pellets

        const calls = imports.trace.mock.calls;
        // calls[0] is P_ProjectSource trace.
        // calls[1] to calls[12] are pellets.

        const firstPelletEnd = calls[1][3];
        let allSame = true;
        for (let i = 2; i < 13; i++) {
            if (calls[i][3].x !== firstPelletEnd.x || calls[i][3].y !== firstPelletEnd.y || calls[i][3].z !== firstPelletEnd.z) {
                allSame = false;
                break;
            }
        }
        expect(allSame).toBe(false);

        expect(T_Damage).toHaveBeenCalledWith(
            target,
            player,
            player,
            expect.anything(), // dir
            expect.anything(), // point
            expect.anything(), // normal
            4, // damage
            1, // knockback
            16, // flags
            2, // mod
            0, // dflags
            expect.anything(), // multicast
            expect.anything()  // options (hooks)
        );
    });
});
