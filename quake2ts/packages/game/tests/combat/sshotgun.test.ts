// =================================================================
// Quake II - Super Shotgun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { createGameImportsAndEngine, createEntityFactory, createMonsterEntityFactory } from '@quake2ts/test-utils';

describe('Super Shotgun', () => {
    it('should consume 2 shells and fire 20 pellets', () => {
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        Object.assign(playerStart, createEntityFactory({
            classname: 'info_player_start',
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 90, z: 0 }
        }));
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });

        const target = game.entities.spawn();
        Object.assign(target, createMonsterEntityFactory('monster_dummy', {
            health: 100
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 0, y: 10, z: 0 },
            plane: { normal: { x: 0, y: -1, z: 0 } },
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Shells]).toBe(8);
        expect(imports.trace).toHaveBeenCalledTimes(21); // 1 source + 20 pellets
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            player,
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            6, // damage
            1, // knockback
            16,
            3, // mod
            0,
            expect.anything(),
            expect.anything()
        );
    });

    it('should use tighter spread and consume less damage in precision mode', () => {
         const T_Damage = vi.spyOn(damage, 'T_Damage');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        Object.assign(playerStart, createEntityFactory({
             classname: 'info_player_start',
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 90, z: 0 }
        }));
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.SuperShotgun],
            ammo: { [AmmoType.Shells]: 10 },
        });
        player.client!.buttons |= 32; // BUTTON_ATTACK2

        const target = game.entities.spawn();
        Object.assign(target, createMonsterEntityFactory('monster_dummy', {
            health: 100
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 0, y: 10, z: 0 },
            plane: { normal: { x: 0, y: -1, z: 0 } },
        });

        fire(game, player, WeaponId.SuperShotgun);

        expect(T_Damage).toHaveBeenCalledWith(
            expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(),
            4, // Reduced damage
            expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything()
        );
    });
});
