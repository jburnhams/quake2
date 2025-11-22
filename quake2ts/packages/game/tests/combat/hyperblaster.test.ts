// =================================================================
// Quake II - HyperBlaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';

describe('HyperBlaster', () => {
    it('should consume 1 cell and deal damage', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointContents }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 50 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.HyperBlaster);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(1);
        expect(T_Damage).toHaveBeenCalled();
    });
});
