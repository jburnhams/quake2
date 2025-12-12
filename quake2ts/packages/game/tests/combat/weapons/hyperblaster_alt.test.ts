// =================================================================
// Quake II - HyperBlaster Alt-Fire Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import { hyperBlasterThink } from '../../../src/combat/weapons/hyperblaster.js';
import { getWeaponState } from '../../../src/combat/weapons/state.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';

describe('HyperBlaster Alt-Fire', () => {
    let game: any;
    let player: any;
    let sys: any;

    beforeEach(() => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const linkentity = vi.fn();

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };

        trace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });

        game = createGame({ trace, pointcontents, linkentity, multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });
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
            weapons: [WeaponId.HyperBlaster],
            ammo: { [AmmoType.Cells]: 100 },
            currentWeapon: WeaponId.HyperBlaster
        });
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client.gun_frame = 28; // Idle last
        player.client.weapon_think_time = 0;
    });

    it('should fire normal shots with primary fire', () => {
        player.client.buttons = 1; // Attack
        hyperBlasterThink(player, sys); // Ready -> Firing

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);

        // Advance frame to fire
        // Weapon_Repeating logic
        player.client.weapon_think_time = 0;
        player.client.gun_frame = 6; // Fire Frame

        hyperBlasterThink(player, sys);

        // 1 cell per shot
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(99);

        const state = getWeaponState(player.client.weaponStates, WeaponId.HyperBlaster);
        expect(state.heat).toBeUndefined(); // Normal fire doesn't add heat in my impl?
    });

    it('should fire beam with alt fire (button 32)', () => {
        player.client.buttons = 32; // Attack2
        hyperBlasterThink(player, sys); // Ready -> Firing

        // Force fire frame
        player.client.weapon_think_time = 0;
        player.client.gun_frame = 6;

        hyperBlasterThink(player, sys);

        // 2 cells per shot (fired twice in this test: once on activation, once on second call)
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(96);

        const state = getWeaponState(player.client.weaponStates, WeaponId.HyperBlaster);
        expect(state.heat).toBe(2);
    });

    it('should stop firing when overheated', () => {
        player.client.buttons = 32;
        const state = getWeaponState(player.client.weaponStates, WeaponId.HyperBlaster);
        state.heat = 21; // Max is 20

        // Force fire frame
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = 6;
        player.client.weapon_think_time = 0;

        hyperBlasterThink(player, sys);

        // Should NOT consume ammo
        expect(player.client.inventory.ammo.counts[AmmoType.Cells]).toBe(100);
        // Heat shouldn't increase
        expect(state.heat).toBe(21);
    });

    it('should cool down over time', () => {
        const state = getWeaponState(player.client.weaponStates, WeaponId.HyperBlaster);
        state.heat = 10;
        state.lastFireTime = 1.0; // Current time

        // Advance time
        // game.init will run a frame, which calls player_think -> hyperBlasterThink implicitly.
        // So we don't need to call it manually.
        game.init(2000); // 2.0s

        player.client.buttons = 0; // Not firing

        // Should decay
        expect(state.heat).toBe(9);
    });
});
