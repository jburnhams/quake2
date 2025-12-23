// =================================================================
// Quake II - HyperBlaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('HyperBlaster', () => {
    it('should consume 1 cell and spawn a blaster bolt', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

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
        // source is now offset, not player.origin
        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });

    it('should deal 20 damage in single-player', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const game = createGame({ multicast: vi.fn(), trace } as any, {} as any, { gravity: { x: 0, y: 0, z: -800 } });
        game.deathmatch = false;
        const player = game.entities.spawn();
        player.client = {
            inventory: createPlayerInventory({ weapons: [WeaponId.HyperBlaster], ammo: { [AmmoType.Cells]: 1 } }),
            weaponStates: { states: new Map() }
        } as any;

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });

    it('should deal 15 damage in deathmatch', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');
        const trace = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        const game = createGame({ multicast: vi.fn(), trace } as any, {} as any, { gravity: { x: 0, y: 0, z: -800 } });
        game.deathmatch = true;
        const player = game.entities.spawn();
        player.client = {
            inventory: createPlayerInventory({ weapons: [WeaponId.HyperBlaster], ammo: { [AmmoType.Cells]: 1 } }),
            weaponStates: { states: new Map() }
        } as any;

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 15, 1000, DamageMod.HYPERBLASTER);
    });
});
