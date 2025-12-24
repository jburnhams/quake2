// =================================================================
// Quake II - Machinegun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createGameImportsAndEngine, createEntityFactory, createMonsterEntityFactory } from '@quake2ts/test-utils';

describe('Machinegun', () => {
    it('should consume 1 bullet and deal damage', () => {
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
            weapons: [WeaponId.Machinegun],
            ammo: { [AmmoType.Bullets]: 50 },
        });

        const target = game.entities.spawn();
        Object.assign(target, createMonsterEntityFactory('monster_dummy', {
            health: 100
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.Machinegun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(imports.trace).toHaveBeenCalledTimes(2); // 1 source + 1 bullet
        expect(T_Damage).toHaveBeenCalled();
    });
});
