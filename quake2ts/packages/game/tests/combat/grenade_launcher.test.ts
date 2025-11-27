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

describe('Grenade Launcher', () => {
    it('should consume 1 grenade and spawn a projectile', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');
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
            weapons: [WeaponId.GrenadeLauncher],
            ammo: { [AmmoType.Grenades]: 10 },
        });

        fire(game, player, WeaponId.GrenadeLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);
        expect(createGrenade).toHaveBeenCalled();
    });

    it('should explode on impact with an entity', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(player);

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;
        game.entities.finalizeSpawn(target);

        projectiles.createGrenade(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 120, 600);
        const grenade = game.entities.find(e => e.classname === 'grenade')!;

        expect(grenade).toBeDefined();

        // Simulate touch with target
        if (grenade.touch) {
            grenade.touch(grenade, target, null, null);
        }

        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), grenade, player, 120, player, 120, expect.anything(), DamageMod.GRENADE, game.time, expect.anything(), expect.any(Function));
    });
});
