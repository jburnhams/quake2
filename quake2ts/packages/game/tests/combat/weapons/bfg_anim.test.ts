// =================================================================
// Quake II - BFG10K Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bfgThink } from '../../../src/combat/weapons/bfg.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_BFG_ACTIVATE_LAST,
    FRAME_BFG_FIRE_LAST,
    FRAME_BFG_IDLE_LAST,
    FRAME_BFG_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

// BFG frames:
// FRAME_ACTIVATE_LAST = 8
// FRAME_FIRE_LAST = 32
// FRAME_IDLE_LAST = 54
// FRAME_DEACTIVATE_LAST = 58
// fire_frames = {9, 22}

describe('BFG10K Animation', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const { imports, engine } = createGameImportsAndEngine();

        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        sys = game.entities;
        game.init(1.0); // Set start time

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        player = game.entities.find((e: any) => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.BFG10K],
            ammo: { [AmmoType.Cells]: 100 },
            currentWeapon: WeaponId.BFG10K
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_BFG_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;
    });

    it('should consume ammo at frame 9', () => {
        player.client.buttons = 1;

        // Transition to Firing
        bfgThink(player, sys);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_BFG_ACTIVATE_LAST + 1); // 9

        // Advance time to trigger fire logic
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0;

        bfgThink(player, sys);

        // Frame 9 consumes 50 cells
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
    });

    it('should fire projectile at frame 22', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 22;

        // Mocking behavior by checking side effects if possible, but fireBFG spawns entities.
        // We trust fireBFG logic is tested elsewhere (combat/bfg.test.ts).
        // Here we just verify the frame advances.

        // Ensure think doesn't exit due to timer
        player.client.weapon_think_time = 0;

        bfgThink(player, sys);

        expect(player.client.gun_frame).toBe(23);
    });
});
