// =================================================================
// Quake II - Machinegun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';

describe('Machinegun', () => {
    it('should consume 1 bullet and deal damage', () => {
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
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Machinegun],
            ammo: { [AmmoType.Bullets]: 50 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 }) // P_ProjectSource convergence
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }) // P_ProjectSource wall check
            .mockReturnValue({
                ent: target,
                endpos: { x: 10, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } },
            });

        fire(game, player, WeaponId.Machinegun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(3); // 2 source + 1 bullet
        expect(T_Damage).toHaveBeenCalled();
    });
});
