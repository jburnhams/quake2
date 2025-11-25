// =================================================================
// Quake II - Rocket Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire, firingRandom } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';

describe('Rocket Launcher', () => {
    it('should consume 1 rocket and spawn a projectile', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const createRocket = vi.spyOn(projectiles, 'createRocket');
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 }, random: firingRandom });

        firingRandom.seed(12345);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.RocketLauncher],
            ammo: { [AmmoType.Rockets]: 10 },
        });

        vi.spyOn(firingRandom, 'irandomRange').mockReturnValue(17);

        fire(game, player, WeaponId.RocketLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(9);

        const expectedDamage = 117;

        expect(createRocket).toHaveBeenCalledWith(
            game.entities,
            player,
            expect.anything(),
            expect.anything(),
            expectedDamage,
            120, // radiusDamage
            650
        );
    });
});
