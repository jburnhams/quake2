// =================================================================
// Quake II - Grenade Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import * as damage from '../../../src/combat/damage.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createTestGame, createEntityFactory, createPlayerEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Grenade Launcher', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should consume 1 grenade and spawn a projectile', () => {
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

        const { game } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.GrenadeLauncher],
                    ammo: { [AmmoType.Grenades]: 10 },
                }),
                weaponStates: { states: new Map() }
            } as any
        }));

        fire(game, player, WeaponId.GrenadeLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);
        expect(createGrenade).toHaveBeenCalled();
    });

    it('should explode on impact with an entity', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { game } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
        }));

        const target = spawnEntity(game.entities, createEntityFactory({
             health: 100,
             takedamage: true
        }));

        projectiles.createGrenade(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 120, 600);

        // Find the grenade
        const grenade = game.entities.find(e => e.classname === 'grenade');

        expect(grenade).toBeDefined();

        // Simulate touch with target
        if (grenade && grenade.touch) {
            grenade.touch(grenade, target, null, null);
        }

        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), grenade, player, 120, player, 120, expect.anything(), DamageMod.GRENADE, game.time, expect.anything(), expect.any(Function));
    });
});
