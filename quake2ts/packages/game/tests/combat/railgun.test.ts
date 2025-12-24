// =================================================================
// Quake II - Railgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory, createMonsterEntityFactory } from '@quake2ts/test-utils';

describe('Railgun', () => {
    it('should consume 1 slug and deal piercing damage', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

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
            weapons: [WeaponId.Railgun],
            ammo: { [AmmoType.Slugs]: 50 },
        });

        // Mock trace hitting 2 targets then wall
        const target1 = game.entities.spawn(); Object.assign(target1, createMonsterEntityFactory('target1'));
        const target2 = game.entities.spawn(); Object.assign(target2, createMonsterEntityFactory('target2'));

        imports.trace
            .mockReturnValueOnce({ ent: null }) // P_ProjectSource
            .mockReturnValueOnce({ ent: target1, fraction: 0.5, endpos: { x: 100, y: 0, z: 0 } })
            .mockReturnValueOnce({ ent: target2, fraction: 0.8, endpos: { x: 200, y: 0, z: 0 } })
            .mockReturnValueOnce({ ent: game.entities.world, fraction: 1.0, endpos: { x: 300, y: 0, z: 0 } });

        fire(game, player, WeaponId.Railgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Slugs]).toBe(49);
        expect(T_Damage).toHaveBeenCalledTimes(2);
        // Verify damage amounts
        expect(T_Damage).toHaveBeenNthCalledWith(1, target1, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), 125, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
        expect(T_Damage).toHaveBeenNthCalledWith(2, target2, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), 125, expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything());
    });
});
