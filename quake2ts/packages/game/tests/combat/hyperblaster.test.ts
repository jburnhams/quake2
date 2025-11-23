// =================================================================
// Quake II - HyperBlaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('HyperBlaster', () => {
    it('should consume 1 cell and spawn a blaster bolt', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');
        const multicast = vi.fn();
        const unicast = vi.fn();

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
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 50 },
        });

        fire(game, player, WeaponId.HyperBlaster);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(49);
        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, player.origin, expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });
});
