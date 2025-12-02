// =================================================================
// Quake II - Railgun Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { railgunThink } from '../../../src/combat/weapons/railgun.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_RAILGUN_ACTIVATE_LAST,
    FRAME_RAILGUN_FIRE_LAST,
    FRAME_RAILGUN_IDLE_LAST,
    FRAME_RAILGUN_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';

// Railgun frames:
// FRAME_ACTIVATE_LAST = 3
// FRAME_FIRE_LAST = 18
// FRAME_IDLE_LAST = 51
// FRAME_DEACTIVATE_LAST = 56
// fire_frames = {4}

describe('Railgun Animation', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };

        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });

        game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
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
            weapons: [WeaponId.Railgun],
            ammo: { [AmmoType.Slugs]: 10 },
            currentWeapon: WeaponId.Railgun
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_RAILGUN_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;
    });

    it('should fire and play animation when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        railgunThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_RAILGUN_ACTIVATE_LAST + 1); // 4

        // Advance time to trigger fire logic
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0;

        railgunThink(player, sys);

        // Frame 4 is fire frame.
        expect(player.client.inventory.ammo.counts[AmmoType.Slugs]).toBe(9);
    });

    it('should cycle through long fire animation', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 4;

        // Advance time
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0;

        railgunThink(player, sys);
        expect(player.client.gun_frame).toBe(5);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
    });
});
