// =================================================================
// Quake II - Guided Rocket Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { fireRocket } from '../../../src/combat/weapons/firing.js';
import { normalizeVec3, dotVec3 } from '@quake2ts/shared';
import { createGameImportsAndEngine } from '@quake2ts/test-utils/game/helpers';

describe('Guided Rocket', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();
        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        sys = game.entities;
        game.init(1000);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        player = game.entities.find((e: any) => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.RocketLauncher],
            ammo: { [AmmoType.Rockets]: 10 },
            currentWeapon: WeaponId.RocketLauncher
        });
        // Default forward aim (X axis)
        player.angles = { x: 0, y: 0, z: 0 };
        player.client.v_angle = { x: 0, y: 0, z: 0 };
    });

    it('should fire normal rocket with primary fire', () => {
        player.client.buttons = 0; // Or 1 (Attack)
        fireRocket(game, player);

        const rocket = sys.find((e: any) => e.classname === 'rocket');
        expect(rocket).toBeDefined();
        expect(rocket.classname).toBe('rocket');
    });

    it('should fire guided rocket with alt fire (button 32)', () => {
        player.client.buttons = 32; // Attack2
        fireRocket(game, player);

        const rocket = sys.find((e: any) => e.classname === 'guided_rocket');
        expect(rocket).toBeDefined();
        expect(rocket.classname).toBe('guided_rocket');
        expect(rocket.owner).toBe(player);
    });

    it('should steer towards player aim', () => {
        player.client.buttons = 32;
        fireRocket(game, player);
        const rocket = sys.find((e: any) => e.classname === 'guided_rocket');

        // Initial velocity should be forward (X axis)
        let dir = normalizeVec3(rocket.velocity);
        expect(dir.x).toBeCloseTo(1);
        expect(dir.y).toBeCloseTo(0);

        // Player turns 90 degrees left (Y axis)
        player.client.v_angle = { x: 0, y: 90, z: 0 };
        player.angles = { x: 0, y: 90, z: 0 };

        // Run frame to process think
        // Rocket thinks every 0.1s
        game.init(1100); // Advance 0.1s (1.1s)
        rocket.nextthink = 1.1; // Ensure think is scheduled (it was scheduled at 1.0 + 0.1)

        // Manually call think or run frame logic
        // We can just call the think function if it's exported, but it's not.
        // Or rely on sys.runFrame if we setup loop correctly.
        // Or manual:
        rocket.think(rocket, sys);

        // Check new velocity
        dir = normalizeVec3(rocket.velocity);
        // Should have turned towards Y
        // Interpolation 0.3
        // New X = 1 + (0 - 1) * 0.3 = 0.7
        // New Y = 0 + (1 - 0) * 0.3 = 0.3
        // Normalized: 0.7/len, 0.3/len.
        // It should be > 0 in Y.
        expect(dir.y).toBeGreaterThan(0.1);
        expect(dir.x).toBeLessThan(1.0);
    });
});
