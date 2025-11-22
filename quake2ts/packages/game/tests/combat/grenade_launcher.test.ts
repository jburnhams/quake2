// =================================================================
// Quake II - Grenade Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';

describe('Grenade Launcher', () => {
    it('should consume 1 grenade and spawn a projectile', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
        };
        const game = createGame({ trace, pointContents }, engine, { gravity: { x: 0, y: 0, z: -800 } });

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
});
