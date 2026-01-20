// =================================================================
// Quake II - Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as damage from '../../../src/combat/damage.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createEntityFactory, createTraceMock } from '@quake2ts/test-utils';

describe('Shotgun', () => {
    it('should consume 1 shell and fire 12 pellets', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { game, imports } = createTestGame();

        // Use factory for playerStart
        // In this test, we skip spawning info_player_start and spawnWorld
        // because we are testing the weapon fire logic directly on a spawned player.

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            angles: { x: 0, y: 90, z: 0 }
        }));
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Shotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        // Use factory for target
        const target = spawnEntity(game.entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        // Mock hit at close range (10 units)
        imports.trace.mockReturnValue(createTraceMock({
            ent: target,
            endpos: { x: 0, y: 10, z: 0 },
            plane: { normal: { x: 0, y: -1, z: 0 }, dist: 0, type: 0, signbits: 0 },
        }));

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

        // Expect 4 (Base damage) because Shotgun has NO falloff in Quake 2.
        // We use expect.anything() for arguments that are hard to predict (vectors, options, functions)
        // to avoid fragility, while verifying the core logic (damage amount, correct entities).
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
