
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';
import { Entity } from '../../../../src/entities/entity.js';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../../src/inventory/ammo.js';
import { Weapon_Generic, Throw_Generic } from '../../../../src/combat/weapons/animation.js';

// Mock dependencies
vi.mock('../../../../src/combat/weapons/switching.js', () => ({
    ChangeWeapon: vi.fn((ent: Entity, weaponId?: string) => {
        if (!ent.client) return;
        if (weaponId) {
             ent.client.weaponstate = WeaponStateEnum.WEAPON_DROPPING;
             ent.client.newWeapon = weaponId;
        } else {
             // Finalize switch (activates new weapon)
             ent.client.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
             ent.client.newWeapon = undefined;
        }
    }),
    NoAmmoWeaponChange: vi.fn((ent: Entity) => {
        if (!ent.client) return;
        ent.client.newWeapon = 'Blaster'; // Mock choice
    })
}));

import { ChangeWeapon, NoAmmoWeaponChange } from '../../../../src/combat/weapons/switching.js';

// Mocks
const mockFire = vi.fn();
const mockSys = {
    timeSeconds: 10,
    sound: vi.fn(),
};

describe('Weapon State Machine Edge Cases', () => {
    let context: any;
    let player: Entity;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createTestContext();
        player = context.entities.spawn();
        player.client = {
            weaponstate: WeaponStateEnum.WEAPON_READY,
            gun_frame: 0,
            weapon_think_time: 0,
            buttons: 0,
            weaponStates: { states: new Map() },
            inventory: {
                ammo: { counts: {} },
                items: [],
                powerups: new Set(),
                currentWeapon: WeaponId.Blaster
            },
            newWeapon: null,
            ping: 0,
            ps: {} as any
        } as any;

        // Setup ammo
        player.client!.inventory.ammo.counts[AmmoType.Bullets] = 50;
        player.client!.inventory.ammo.counts[AmmoType.Shells] = 10;
        player.client!.inventory.ammo.counts[AmmoType.Grenades] = 5;
    });

    it('should queue weapon switch while firing and execute it after animation (Interrupted firing)', () => {
        // Setup firing state
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 10; // Mid-fire
        mockSys.timeSeconds = 10;

        // Request switch
        player.client!.newWeapon = WeaponId.Shotgun; // Arbitrary different weapon

        // Run Generic Weapon Think
        Weapon_Generic(
            player,
            5, // ACTIVATE_LAST
            15, // FIRE_LAST
            20, // IDLE_LAST
            25, // DEACTIVATE_LAST
            null,
            null,
            mockFire,
            mockSys as any
        );

        // Expect state to REMAIN firing (cannot interrupt)
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client!.newWeapon).toBe(WeaponId.Shotgun);
        expect(ChangeWeapon).not.toHaveBeenCalled();

        // Advance to end of firing
        player.client!.gun_frame = 15; // FIRE_LAST
        mockSys.timeSeconds = 11; // Advance time to ensure think runs

         Weapon_Generic(
            player,
            5, // ACTIVATE_LAST
            15, // FIRE_LAST
            20, // IDLE_LAST
            25, // DEACTIVATE_LAST
            null,
            null,
            mockFire,
            mockSys as any
        );

        // The last fire frame steps to idle and the weapon is ready again...
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client!.gun_frame).toBe(16);

        // ...and the next weapon frame starts putting it down (Weapon_HandleNewWeapon).
        mockSys.timeSeconds = 12;
        Weapon_Generic(player, 5, 15, 20, 25, null, null, mockFire, mockSys as any);
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);
        expect(player.client!.gun_frame).toBe(21);
        expect(ChangeWeapon).not.toHaveBeenCalled();
    });

    it('should handle grenade explosion in hand', () => {
        // Setup Grenade
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 11; // FRAME_THROW_HOLD
        player.client!.buttons = 1; // Holding attack
        player.client!.grenade_time = 10 + 3.0; // Detonates at 13.0

        mockSys.timeSeconds = 13.1;

        Throw_Generic(
            player,
            10, // FIRE_LAST (dummy)
            20, // IDLE_LAST
            5,  // THROW_FIRST
            15, // THROW_LAST
            8,  // PRIME_SOUND
            11, // THROW_HOLD
            12, // THROW_FIRE
            mockFire,
            mockSys as any
        );

        // Expect explosion (mockFire called with held=true)
        expect(mockFire).toHaveBeenCalledWith(player, true);
        expect(player.client!.grenade_blew_up).toBe(true);
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
    });

    it('pressing attack with no ammo picks another weapon instead of firing', () => {
        player.client!.inventory.ammo.counts[AmmoType.Shells] = 0;
        player.client!.inventory.currentWeapon = WeaponId.Shotgun;
        player.client!.weaponstate = WeaponStateEnum.WEAPON_READY;
        player.client!.gun_frame = 16;
        player.client!.buttons = 1;
        mockSys.timeSeconds = 10;
        const fireShotgun = vi.fn();

        Weapon_Generic(player, 5, 15, 20, 25, null, [6], fireShotgun, mockSys as any);

        expect(fireShotgun).not.toHaveBeenCalled();
        expect(NoAmmoWeaponChange).toHaveBeenCalled();
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client!.newWeapon).toBe('Blaster');
    });

    it('a thrown weapon being raised is ready on its next weapon frame', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_ACTIVATING;
        player.client!.gun_frame = 0;
        player.client!.weapon_think_time = 0;
        mockSys.timeSeconds = 10;

        Throw_Generic(player, 10, 20, 5, 15, 8, 11, 12, mockFire, mockSys as any);

        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
        expect(player.client!.gun_frame).toBe(11);
        expect(mockFire).not.toHaveBeenCalled();
    });
});
