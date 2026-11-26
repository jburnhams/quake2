// =================================================================
// Quake II - Blaster Weapon Tests
// =================================================================

import { describe, it, expect, vi, afterEach } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { createTestGame, spawnEntity, createPlayerEntityFactory, createTraceMock } from '@quake2ts/test-utils';

describe('Blaster', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not consume ammo and should spawn a blaster bolt', () => {
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const { game } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            angles: { x: 0, y: 90, z: 0 }
        }));
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
            ammo: {},
        });

        fire(game, player, WeaponId.Blaster);

        // source is offset, not player.origin
        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 15, 1500, DamageMod.BLASTER);
    });

    it('should travel at the correct speed', () => {
        const { game, imports } = createTestGame();
        // Custom trace mock for empty world
        imports.trace.mockImplementation((start, mins, maxs, end) => {
            return createTraceMock({
                fraction: 1.0,
                endpos: end,
                allsolid: false,
                startsolid: false,
                ent: null,
                surface: null,
                contents: 0,
                plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0, type: 0, signbits: 0 }
            });
        });

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             angles: { x: 0, y: 0, z: 0 } // Fire along X-axis
        }));
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
            ammo: {},
        });

        // Fire the weapon to create the projectile
        fire(game, player, WeaponId.Blaster);

        const bolt = game.entities.find(e => e.classname === 'blaster_bolt')!;
        expect(bolt).toBeDefined();

        const initialPosition = { ...bolt.origin };

        // Simulate game time passing
        const timeDeltaMs = 100; // 0.1 seconds
        game.frame({ frame: 1, deltaMs: timeDeltaMs, startTimeMs: 0 });

        const newPosition = bolt.origin;
        const distance = Math.sqrt(
            Math.pow(newPosition.x - initialPosition.x, 2) +
            Math.pow(newPosition.y - initialPosition.y, 2) +
            Math.pow(newPosition.z - initialPosition.z, 2)
        );

        // 1500 units/sec * 0.1 sec = 150 units
        expect(distance).toBeCloseTo(150);
    });
});
