// =================================================================
// Quake II - BFG10K Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';

describe('BFG10K', () => {
    it('should consume 50 cells and spawn a projectile', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');

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
            weapons: [WeaponId.BFG10K],
            ammo: { [AmmoType.Cells]: 100 },
        });

        fire(game, player, WeaponId.BFG10K);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
        expect(createBfgBall).toHaveBeenCalled();
    });
});
