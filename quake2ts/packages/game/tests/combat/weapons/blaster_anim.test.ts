// =================================================================
// Quake II - Blaster Animation Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blasterThink } from '../../../src/combat/weapons/blaster.js';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId } from '../../../src/inventory/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import {
    FRAME_BLASTER_ACTIVATE_LAST,
    FRAME_BLASTER_FIRE_LAST,
    FRAME_BLASTER_IDLE_LAST,
    FRAME_BLASTER_DEACTIVATE_LAST
} from '../../../src/combat/weapons/frames.js';

// Blaster frames (from blaster.ts):
// FRAME_ACTIVATE_LAST = 4
// FRAME_FIRE_LAST = 8
// FRAME_IDLE_LAST = 52
// FRAME_DEACTIVATE_LAST = 55
// pause_frames = {19, 32}
// fire_frames = {5}

describe('Blaster Animation', () => {
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
            weapons: [WeaponId.Blaster],
            currentWeapon: WeaponId.Blaster
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_BLASTER_FIRE_LAST + 1;
        player.client.weapon_think_time = 0;
    });

    it('should fire and play animation when button is pressed', () => {
        player.client.buttons = 1; // BUTTON_ATTACK

        // Initial state: Ready
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);

        // Run think
        blasterThink(player, sys);

        // Should transition to FIRING
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // Start frame is FRAME_ACTIVATE_LAST + 1 = 5
        expect(player.client.gun_frame).toBe(FRAME_BLASTER_ACTIVATE_LAST + 1);

        // Advance time and think again
        game.frame({ frame: 1, deltaMs: 100, startTimeMs: 1000 });
        player.client.weapon_think_time = 0; // Force ready

        // Frame 5 is fire frame for blaster. Logic should call fire().
        // Mock fireBlaster called via import?
        // We can check if projectile count increased or just trust the integration.
        // For unit test, we verify frame progression.

        blasterThink(player, sys);
        // Should advance to next frame
        expect(player.client.gun_frame).toBe(FRAME_BLASTER_ACTIVATE_LAST + 2);
    });

    it('should cycle through idle frames', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_BLASTER_FIRE_LAST + 1; // 9

        blasterThink(player, sys);

        expect(player.client.gun_frame).toBe(10);
        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
    });

    it('should loop idle frames', () => {
        player.client.buttons = 0;
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = FRAME_BLASTER_IDLE_LAST; // 52

        blasterThink(player, sys);

        // Should reset to FRAME_FIRE_LAST + 1 = 9
        expect(player.client.gun_frame).toBe(FRAME_BLASTER_FIRE_LAST + 1);
    });
});
