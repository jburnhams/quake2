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

    it('fires as soon as attack is pressed, then once a weapon frame, looping the fire frames', () => {
        player.client.buttons = 1; // BUTTON_ATTACK
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        // Ready -> firing, and the first shot in the same think.
        hyperBlasterThink(player, sys);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_FRAME);
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(49);

        // Nothing more until the next weapon frame.
        hyperBlasterThink(player, sys);
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(49);

        player.client.weapon_think_time = 0;
        hyperBlasterThink(player, sys);
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(48);
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_FRAME + 1);

        // From the last fire frame it loops back to the first.
        player.client.gun_frame = FRAME_HYPERBLASTER_FIRE_LAST;
        player.client.weapon_think_time = 0;
        hyperBlasterThink(player, sys);
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_FRAME);
    });

    it('goes back to idle when the button is let go', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = FRAME_HYPERBLASTER_FIRE_FRAME;

        hyperBlasterThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client.gun_frame).toBe(FRAME_HYPERBLASTER_FIRE_LAST + 1);
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
    });

    it('out of cells with attack held, it winds down and picks another weapon', () => {
        player.client.inventory.ammo.counts[AmmoType.Cells] = 1;
        player.client.inventory.ownedWeapons.add(WeaponId.Blaster);
        player.client.buttons = 1;

        hyperBlasterThink(player, sys);
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(0);

        player.client.weapon_think_time = 0;
        hyperBlasterThink(player, sys);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client.newWeapon).toBe(WeaponId.Blaster);
    });
});
