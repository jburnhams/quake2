// =================================================================
// Quake II - Grenade Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Grenade Launcher', () => {
    it('should consume 1 grenade and spawn a projectile', () => {
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

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
            weapons: [WeaponId.GrenadeLauncher],
            ammo: { [AmmoType.Grenades]: 50 },
        });

        fire(game, player, WeaponId.GrenadeLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(49);
        // createGrenade(sys, owner, start, dir, damage, speed, timer)
        expect(createGrenade).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 120, 600, undefined);
    });
});
