// =================================================================
// Quake II - Grenade Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';
import { createEntityFactory } from '@quake2ts/test-utils';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';

describe('Grenade Launcher', () => {
    it('should consume 1 grenade and spawn a projectile', () => {
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = createEntityFactory({
             classname: 'info_player_start',
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 }
        });
        game.entities.spawn = vi.fn().mockReturnValue(playerStart);
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.GrenadeLauncher],
                    ammo: { [AmmoType.Grenades]: 10 },
                }),
                weaponStates: { states: new Map() }
            } as any
        });
        game.entities.find = vi.fn().mockReturnValue(player);

        fire(game, player, WeaponId.GrenadeLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);
        expect(createGrenade).toHaveBeenCalled();
    });

    it('should explode on impact with an entity', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const player = createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
        });
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        const target = createEntityFactory({
             health: 100,
             takedamage: true
        });
        game.entities.finalizeSpawn(target);

        // We need to inject the grenade into the system or mock return value
        const grenade = createEntityFactory({ classname: 'grenade' });
        // Since createGrenade calls spawn, let's mock spawn to return our grenade
        game.entities.spawn = vi.fn().mockReturnValue(grenade);

        projectiles.createGrenade(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 120, 600);

        // Simulate touch with target
        if (grenade.touch) {
            grenade.touch(grenade, target, null, null);
        }

        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), grenade, player, 120, player, 120, expect.anything(), DamageMod.GRENADE, game.time, expect.anything(), expect.any(Function));
    });
});
