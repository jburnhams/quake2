// =================================================================
// Quake II - Rocket Launcher Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rocketLauncherThink } from '../../../src/combat/weapons/rocket.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_ROCKET_ACTIVATE_LAST,
    FRAME_ROCKET_FIRE_LAST,
    FRAME_ROCKET_IDLE_LAST,
    FRAME_ROCKET_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

// Rocket Launcher frames (from rocket.ts):
// FRAME_ACTIVATE_LAST = 3
// FRAME_FIRE_LAST = 12
// FRAME_IDLE_LAST = 34
// FRAME_DEACTIVATE_LAST = 38
// pause_frames = {25, 33}
// fire_frames = {4}

describe('Rocket Launcher Animation', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();
        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        sys = game.entities;
        game.init(1.0);

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
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_ROCKET_FIRE_LAST + 1; // 13
        player.client.weapon_think_time = 0;
    });

    it('should fire and play animation when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        // Initial state: Ready
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        // Run think
        rocketLauncherThink(player, sys);

        // Should transition to FIRING
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // Start frame is FRAME_ACTIVATE_LAST + 1 = 4
        expect(player.client.gun_frame).toBe(FRAME_ROCKET_ACTIVATE_LAST + 1); // 4

        // Advance time to trigger fire logic
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0;

        rocketLauncherThink(player, sys);

        // Frame 4 is FIRE frame.
        // Check ammo consumed (if fire logic runs)
        expect(player.client.inventory.ammo.counts[AmmoType.Rockets]).toBe(9);
    });

    it('should cycle through idle frames', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = 13;

        rocketLauncherThink(player, sys);

        expect(player.client.gun_frame).toBe(14);
    });
});
