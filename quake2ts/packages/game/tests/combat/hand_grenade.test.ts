// =================================================================
// Quake II - Hand Grenade Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import * as damage from '../../src/combat/damage.js';
import { createPlayerWeaponStates, WeaponStateEnum } from '../../src/combat/weapons/state.js';
import {
    FRAME_GRENADE_THROW_FIRST, FRAME_GRENADE_PRIME_SOUND,
    FRAME_GRENADE_THROW_HOLD, FRAME_GRENADE_THROW_FIRE
} from '../../src/combat/weapons/frames.js';
import { EntitySystem } from '../../src/entities/system.js';

// Mock GameExports
function createMockGame() {
    const game: any = {
        trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
        sound: vi.fn(),
        centerprintf: vi.fn(),
        multicast: vi.fn(),
        unicast: vi.fn(),
        pointcontents: vi.fn(),
        linkentity: vi.fn(),
        time: 0,
        random: {
             frandom: () => 0.5,
             crandom: () => 0,
             irandom: () => 0
        }
    };

    game.entities = {
        spawn: () => ({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            mins: { x: 0, y: 0, z: 0 },
            maxs: { x: 0, y: 0, z: 0 },
            size: { x: 0, y: 0, z: 0 },
            index: 1
        } as any),
        finalizeSpawn: vi.fn(),
        killBox: vi.fn(),
        useTargets: vi.fn(),
        modelIndex: vi.fn().mockReturnValue(1),
        scheduleThink: vi.fn(),
        sound: game.sound,
        get timeSeconds() { return game.time; }
    } as unknown as EntitySystem;

    return game;
}

describe('Hand Grenade', () => {
    it('should start cooking when fire button is held', () => {
        const game = createMockGame();
        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
            ps: { gunframe: 0 } as any,
            weaponstate: WeaponStateEnum.WEAPON_READY,
            gun_frame: 0
        } as any;

        // First frame: Start cooking (Transition from READY to FIRING)
        fire(game, player, WeaponId.HandGrenade);

        // Should be in FIRING state
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_FIRST);
        expect(game.sound).not.toHaveBeenCalled();
    });

    it('should increase throw speed based on hold time', () => {
        const game = createMockGame();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
            weaponstate: WeaponStateEnum.WEAPON_READY,
            gun_frame: 0
        } as any;

        // Start cooking at T=0
        fire(game, player, WeaponId.HandGrenade);

        // Loop enough times to reach hold
        for (let i = 0; i < 7; i++) { // Reach 11
             player.client!.weapon_think_time = 0;
             game.time += 0.1;
             fire(game, player, WeaponId.HandGrenade);
        }

        // Now at frame 11 (THROW_HOLD).
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_HOLD);

        // We hold for 1.0s MORE.
        for (let i = 0; i < 10; i++) { // 1.0s
            player.client!.weapon_think_time = 0;
            game.time += 0.1;
            fire(game, player, WeaponId.HandGrenade);
        }

        // Release button
        player.client!.buttons = 0;
        player.client!.weapon_think_time = 0;
        fire(game, player, WeaponId.HandGrenade); // This triggers transition to THROW_FIRE (12)

        // Next frame triggers actual throw (check for 12)
        player.client!.weapon_think_time = 0;
        game.time += 0.1;
        fire(game, player, WeaponId.HandGrenade);

        // Check createGrenade call
        // Speed: 400 + (1.0 * 200) = 600.
        expect(createGrenade).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            120,
            expect.closeTo(600, 20),
            expect.any(Number)
        );
    });

    it('should use P_ProjectSource with correct offset for throw origin', () => {
        const game = createMockGame();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');

        // Setup player facing East (1, 0, 0)
        // AngleVectors(0, 0, 0) -> Forward(1,0,0), Right(0,-1,0), Up(0,0,1)
        const player = game.entities.spawn();
        player.origin = { x: 100, y: 100, z: 100 };
        player.viewheight = 22;
        player.angles = { x: 0, y: 0, z: 0 };
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 0, // Release immediately to throw
            weaponstate: WeaponStateEnum.WEAPON_FIRING,
            gun_frame: FRAME_GRENADE_THROW_HOLD // Ready to throw
        } as any;

        // Trigger throw logic (release button from hold frame)
        // Transition to THROW_FIRE (12)
        player.client!.weapon_think_time = 0;
        fire(game, player, WeaponId.HandGrenade);

        // Execute throw frame (12)
        player.client!.weapon_think_time = 0;
        fire(game, player, WeaponId.HandGrenade);

        // Expected Origin calculation:
        // Eye: 100, 100, 122
        // Offset: 2, 0, -14
        // Forward (1,0,0) * 2 = 2, 0, 0
        // Right (0,-1,0) * 0 = 0, 0, 0
        // Up (0,0,1) * -14 = 0, 0, -14
        // Result: 102, 100, 108

        expect(createGrenade).toHaveBeenCalledWith(
            expect.anything(),
            player,
            expect.objectContaining({
                x: expect.closeTo(102),
                y: expect.closeTo(100),
                z: expect.closeTo(108)
            }),
            expect.anything(),
            120, // damage
            expect.anything(), // speed
            expect.anything() // timer
        );
    });

    it('should explode in hand if held too long (3.0s)', () => {
        const game = createMockGame();
        const createGrenade = vi.spyOn(projectiles, 'createGrenade');
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.HandGrenade],
                ammo: { [AmmoType.Grenades]: 5 },
            }),
            weaponStates: createPlayerWeaponStates(),
            buttons: 1, // BUTTON_ATTACK
            weaponstate: WeaponStateEnum.WEAPON_READY,
            gun_frame: 0
        } as any;

        // Start firing
        fire(game, player, WeaponId.HandGrenade);

        // Reach hold frame
        for (let i = 0; i < 7; i++) {
             player.client!.weapon_think_time = 0;
             game.time += 0.1;
             fire(game, player, WeaponId.HandGrenade);
        }

        // Hold for 4.0s
        for (let i = 0; i < 40; i++) {
            player.client!.weapon_think_time = 0;
            game.time += 0.1;
            fire(game, player, WeaponId.HandGrenade);
        }

        expect(createGrenade).not.toHaveBeenCalled();
        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(player.client!.inventory.ammo.counts[AmmoType.Grenades]).toBe(4);
    });
});
