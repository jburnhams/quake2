// =================================================================
// Quake II - Rocket Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fire, firingRandom } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory } from '@quake2ts/test-utils';

// Mock projectiles
vi.mock('../../../src/entities/projectiles.js', async () => {
    const { createMockProjectiles } = await import('@quake2ts/test-utils/mocks/projectiles');
    return createMockProjectiles();
});

describe('Rocket Launcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should consume 1 rocket and spawn a projectile', () => {
        const { game } = createTestGame({
            config: { random: firingRandom }
        });

        firingRandom.seed(12345);

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        }));

        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.RocketLauncher],
            ammo: { [AmmoType.Rockets]: 10 },
        });

        // Set the damage mod random result
        vi.spyOn(firingRandom, 'irandomRange').mockReturnValue(17);

        fire(game, player, WeaponId.RocketLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(9);

        // Rocket base damage 100 + 17 = 117
        const expectedDamage = 117;

        expect(projectiles.createRocket).toHaveBeenCalledWith(
            game.entities,
            player,
            expect.anything(),
            expect.anything(),
            expectedDamage,
            120, // radiusDamage
            650  // speed
        );
    });
});
