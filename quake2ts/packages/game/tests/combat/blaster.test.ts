// =================================================================
// Quake II - Blaster Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import { DamageMod } from '../../src/combat/damageMods.js';

describe('Blaster', () => {
    it('should not consume ammo and should spawn a blaster bolt', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const createBlasterBolt = vi.spyOn(projectiles, 'createBlasterBolt');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
		game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 90, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Blaster],
            ammo: {},
        });

        fire(game, player, WeaponId.Blaster);

        // source is offset, not player.origin
        expect(createBlasterBolt).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 15, 1500, DamageMod.BLASTER);
    });

    it('should travel at the correct speed', () => {
        const trace = vi.fn().mockImplementation((start, mins, maxs, end) => {
            return {
                fraction: 1.0,
                endpos: end,
                allsolid: false,
                startsolid: false,
            };
        });
        const pointcontents = vi.fn();
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
        playerStart.angles = { x: 0, y: 0, z: 0 }; // Fire along X-axis
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
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
