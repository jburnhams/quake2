// =================================================================
// Quake II - Grenade Launcher Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { grenadeLauncherThink } from '../../../src/combat/weapons/grenadelauncher.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_GRENADELAUNCHER_ACTIVATE_LAST,
    FRAME_GRENADELAUNCHER_FIRE_LAST,
    FRAME_GRENADELAUNCHER_IDLE_LAST,
    FRAME_GRENADELAUNCHER_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

// Grenade Launcher frames:
// FRAME_ACTIVATE_LAST = 5
// FRAME_FIRE_LAST = 16
// FRAME_IDLE_LAST = 36
// FRAME_DEACTIVATE_LAST = 39
// fire_frames = {6}

describe('Grenade Launcher Animation', () => {
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
            weapons: [WeaponId.GrenadeLauncher],
            ammo: { [AmmoType.Grenades]: 10 },
            currentWeapon: WeaponId.GrenadeLauncher
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_GRENADELAUNCHER_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;
    });

    it('should start charging when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        grenadeLauncherThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_GRENADELAUNCHER_ACTIVATE_LAST + 1); // 6
        expect(player.client.weapon_charge_start_time).toBeDefined();

        // Should NOT fire yet (holding)
        expect(player.client.inventory.ammo.counts[AmmoType.Grenades]).toBe(10);
    });

    it('should fire on release (tap)', () => {
        player.client.buttons = 1; // BUTTON_ATTACK
        grenadeLauncherThink(player, sys); // Ready -> Firing

        // Release button
        player.client.buttons = 0;
        player.client.weapon_think_time = 0; // ready to think

        grenadeLauncherThink(player, sys);

        // Should fire
        expect(player.client.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);
        // Advance frame
        expect(player.client.gun_frame).toBe(7);
        expect(player.client.weapon_charge_start_time).toBeUndefined();
    });

    it('should fire on max hold', () => {
        player.client.buttons = 1; // BUTTON_ATTACK
        grenadeLauncherThink(player, sys); // Ready -> Firing

        const startTime = player.client.weapon_charge_start_time; // in seconds

        // Hold for 3.1 seconds
        // game.init takes milliseconds
        game.init((startTime + 3.1) * 1000);
        player.client.weapon_think_time = 0;

        grenadeLauncherThink(player, sys);

        // Should fire due to timeout
        expect(player.client.inventory.ammo.counts[AmmoType.Grenades]).toBe(9);
        expect(player.client.gun_frame).toBe(7);
        expect(player.client.weapon_charge_start_time).toBeUndefined();
    });

    it('should cycle through fire animation after firing', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 7; // Already fired

        player.client.weapon_think_time = 0;

        grenadeLauncherThink(player, sys);
        expect(player.client.gun_frame).toBe(8);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
    });
});
