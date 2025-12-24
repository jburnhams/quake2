// =================================================================
// Quake II - Blaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Blaster', () => {
    it('should spawn a blaster bolt', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

       const playerStart = game.entities.spawn();
       Object.assign(playerStart, createEntityFactory({
             classname: 'info_player_start',
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 }
        }));
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
        });

        fire(game, player, WeaponId.Blaster);

        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 15, 1500, DamageMod.BLASTER);
    });
});
