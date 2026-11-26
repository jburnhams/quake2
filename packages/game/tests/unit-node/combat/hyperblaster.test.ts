// =================================================================
// Quake II - HyperBlaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('HyperBlaster', () => {
    it('should consume 1 cell and spawn a blaster bolt', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { game } = createTestGame();

        // Spawn a player
        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 }
        }));
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
        const { game } = createTestGame({ config: { deathmatch: false } });

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             client: {
                 inventory: createPlayerInventory({ weapons: [WeaponId.HyperBlaster], ammo: { [AmmoType.Cells]: 1 } }),
                 weaponStates: { states: new Map() }
             } as any
        }));

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 20, 1000, DamageMod.HYPERBLASTER);
    });

    it('should deal 15 damage in deathmatch', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');
        const { game } = createTestGame({ config: { deathmatch: true } });

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             client: {
                 inventory: createPlayerInventory({ weapons: [WeaponId.HyperBlaster], ammo: { [AmmoType.Cells]: 1 } }),
                 weaponStates: { states: new Map() }
             } as any
        }));

        fire(game, player, WeaponId.HyperBlaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 15, 1000, DamageMod.HYPERBLASTER);
    });
});
