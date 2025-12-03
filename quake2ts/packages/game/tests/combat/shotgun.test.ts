// =================================================================
// Quake II - Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { angleVectors } from '@quake2ts/shared';

describe('Shotgun', () => {
    it('should consume 1 shell and fire 12 pellets', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 90, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Shotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 }) // P_ProjectSource convergence
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }) // P_ProjectSource wall check
            .mockReturnValue({
                ent: target,
                endpos: { x: 0, y: 10, z: 0 },
                plane: { normal: { x: 0, y: -1, z: 0 } },
            });

        fire(game, player, WeaponId.Shotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(9);
        expect(trace).toHaveBeenCalledTimes(14); // 2 for P_ProjectSource + 12 pellets

        const calls = trace.mock.calls;
        // calls[0,1] is P_ProjectSource trace.
        // calls[2] to calls[13] are pellets.

        const firstPelletEnd = calls[2][3];
        let allSame = true;
        for (let i = 3; i < 14; i++) {
            if (calls[i][3].x !== firstPelletEnd.x || calls[i][3].y !== firstPelletEnd.y || calls[i][3].z !== firstPelletEnd.z) {
                allSame = false;
                break;
            }
        }
        expect(allSame).toBe(false);

        expect(T_Damage).toHaveBeenCalledWith(target, player, player, expect.anything(), expect.anything(), expect.anything(), 4, 1, 16, 2, game.time, expect.any(Function));
    });
});
