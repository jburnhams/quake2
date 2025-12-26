// =================================================================
// Quake II - HyperBlaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createTestContext, createEntityFactory, spawnEntity, createGameImportsAndEngine } from '@quake2ts/test-utils';
import { createGame } from '../../src/index.js';

describe('HyperBlaster', () => {
    it('should consume 1 cell and spawn a blaster bolt', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        spawnEntity(entities, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        }));

        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 50 },
        });

        fire(game, player, WeaponId.HyperBlaster);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(49);
        // source is now offset, not player.origin
        expect(createBlasterBolt).toHaveBeenCalledWith(entities, player, expect.anything(), expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });

    it('should deal 20 damage in single-player', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });
        // Default is SP (deathmatch=false)

        spawnEntity(entities, createEntityFactory({
             classname: 'info_player_start'
        }));
        game.spawnWorld();
        const player = entities.find(e => e.classname === 'player')!;

        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 1 },
        });

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });

    it('should deal 15 damage in deathmatch', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        // Manually create game with deathmatch: true using test-utils helpers
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine as any, {
            gravity: { x: 0, y: 0, z: -800 },
            deathmatch: true
        });

        spawnEntity(game.entities, createEntityFactory({
             classname: 'info_player_start'
        }));

        // In DM, spawnWorld doesn't auto-spawn player usually, or maybe it does?
        // createGame logic says: if (!deathmatch) { spawn player }
        // So we need to manually spawn player or use clientConnect/Begin flow.

        const player = spawnEntity(game.entities, createEntityFactory({
            classname: 'player'
        }));

        player.client = {
            inventory: createPlayerInventory({ weapons: [WeaponId.HyperBlaster], ammo: { [AmmoType.Cells]: 1 } }),
            weaponStates: { states: new Map() }
        } as any;

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 15, 1000, DamageMod.HYPERBLASTER);
    });
});
