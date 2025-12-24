// =================================================================
// Quake II - Rocket Launcher Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory } from '@quake2ts/test-utils';

describe('Rocket Launcher', () => {
    it('should consume 1 rocket and spawn a projectile', () => {
        const createRocket = vi.spyOn(projectiles, 'createRocket');

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
            weapons: [WeaponId.RocketLauncher],
            ammo: { [AmmoType.Rockets]: 50 },
        });

        // Mock irandom to return 0 for deterministic damage (100 + 0)
        game.random.irandom = vi.fn().mockReturnValue(0);

        fire(game, player, WeaponId.RocketLauncher);

        expect(player.client!.inventory.ammo.counts[AmmoType.Rockets]).toBe(49);
        // createRocket(sys, owner, start, dir, damage, radiusDamage, speed, flashtype)
        // Default flashtype is 0 if omitted in implementation, but here it's omitted in call if default param is used?
        // Checking firing.ts: createRocket(..., 650) - flashtype is omitted.
        // So we expect 650.
        // The previous failure expected 120 and received 108.
        // Wait, damage is 100 + irandom(21).
        // 108 implies irandom returned 8.
        // We mocked irandom above to 0, so damage should be 100.
        expect(createRocket).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 100, 120, 650);
    });
});
