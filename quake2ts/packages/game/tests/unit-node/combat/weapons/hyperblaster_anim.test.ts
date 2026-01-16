// =================================================================
// Quake II - HyperBlaster Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hyperBlasterThink } from '../../../../src/combat/weapons/hyperblaster.js';
import { createGame } from '../../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import {
    FRAME_HYPERBLASTER_ACTIVATE_LAST,
    FRAME_HYPERBLASTER_FIRE_FRAME,
    FRAME_HYPERBLASTER_FIRE_LAST,
    FRAME_HYPERBLASTER_IDLE_LAST,
    FRAME_HYPERBLASTER_DEACTIVATE_LAST
} from '../../../../src/combat/weapons/frames.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

// HyperBlaster frames:
// FRAME_ACTIVATE_LAST = 5
// FRAME_FIRE_FRAME = 6
// FRAME_FIRE_LAST = 9
// FRAME_IDLE_LAST = 28
// FRAME_DEACTIVATE_LAST = 32

describe('HyperBlaster Animation', () => {
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
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 50 },
            currentWeapon: WeaponId.HyperBlaster
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_HYPERBLASTER_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;
    });

    it('should fire and loop animation when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        // Initial state: Ready
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        // Run think
        hyperBlasterThink(player, sys);

        // Should transition to FIRING
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // Start frame is FRAME_FIRE_FRAME - 1 + 1 (via Generic) = ACTIVATE_LAST + 1 = 6?
        // Wait, repeating weapon delegates to Generic for activation.
        // ACTIVATE_LAST passed is FRAME_FIRE_FRAME - 1 = 5.
        // So generic sets gun_frame to 5 + 1 = 6.
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_FRAME); // 6

        // Advance time to trigger fire logic (since it delegates to generic for first frame? No, repeating logic handles fire immediately?)
        // Wait, repeating weapon logic:
        // if (firing) check frame.
        // If we just transitioned, next think handles it.
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0;

        // Note: game.frame() executes the frame which runs player think.
        // We do not need to call hyperBlasterThink(player, sys) manually.

        // Check ammo consumed
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(49);

        // Expect frame to advance
        expect(player.client.gun_frame).toBe(7);

        // Advance to end of fire loop
        player.client.gun_frame = FRAME_HYPERBLASTER_FIRE_LAST; // 9
        game.frame({ frame: 2, deltaMs: 100, startTimeMs: 1100 });
        player.client.weapon_think_time = 0;

        // Should loop back to FRAME_FIRE_FRAME
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_FRAME);
    });

    it('should stop firing when button released', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = FRAME_HYPERBLASTER_FIRE_FRAME;

        hyperBlasterThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_IDLE_LAST + 1);
    });
});
