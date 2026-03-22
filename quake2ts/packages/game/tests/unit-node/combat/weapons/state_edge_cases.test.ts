
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createTestContext,
    TestContext,
    spawnEntity,
    createPlayerEntityFactory,
    createPlayerStateFactory
} from '@quake2ts/test-utils';
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

describe('Weapon State Machine Edge Cases', () => {
    let context: TestContext;
    let player: Entity;

    beforeEach(() => {
        vi.clearAllMocks();
        context = createTestContext();

        // Initialize player entity with a complete client state
        player = spawnEntity(context.entities, createPlayerEntityFactory({
            client: {
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
                newWeapon: undefined, // Null is typically not used in TS types here unless specified
                ping: 0,
                ps: createPlayerStateFactory()
            }
        }));

        // Setup starting ammo counts
        if (player.client) {
            player.client.inventory.ammo.counts[AmmoType.Bullets] = 50;
            player.client.inventory.ammo.counts[AmmoType.Shells] = 10;
            player.client.inventory.ammo.counts[AmmoType.Grenades] = 5;
        }
    });

    it('should queue weapon switch while firing and execute it after animation (Interrupted firing)', () => {
        // Setup firing state mid-fire
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 10;
        context.entities.timeSeconds = 10;

        // Request switch to another weapon
        player.client!.newWeapon = WeaponId.Shotgun;

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
            context.entities
        );

        // Expect state to REMAIN firing (cannot interrupt)
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client!.newWeapon).toBe(WeaponId.Shotgun);
        expect(ChangeWeapon).not.toHaveBeenCalled();

        // Advance frame to the end of firing sequence
        player.client!.gun_frame = 15; // FIRE_LAST
        context.entities.timeSeconds = 11; // Advance time to ensure think runs

        Weapon_Generic(
            player,
            5, // ACTIVATE_LAST
            15, // FIRE_LAST
            20, // IDLE_LAST
            25, // DEACTIVATE_LAST
            null,
            null,
            mockFire,
            context.entities
        );

        // NOW it should switch
        expect(ChangeWeapon).toHaveBeenCalledWith(player, WeaponId.Shotgun);
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_DROPPING);
    });

    it('should handle grenade explosion in hand', () => {
        // Setup hand grenade state holding attack
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 11; // FRAME_THROW_HOLD
        player.client!.buttons = 1; // Holding attack button
        player.client!.grenade_time = 10 + 3.0; // Simulated detonation time at 13.0

        context.entities.timeSeconds = 13.1;

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
            context.entities
        );

        // Expect explosion (mockFire called with held=true)
        expect(mockFire).toHaveBeenCalledWith(player, true);
        expect(player.client!.grenade_blew_up).toBe(true);
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_READY);
    });

    it('should trigger switch after animation if ammo is depleted (Empty Click)', () => {
        // Setup shotgun firing sequence with 0 ammo
        player.client!.inventory.ammo.counts[AmmoType.Shells] = 0;
        player.client!.inventory.currentWeapon = WeaponId.Shotgun;
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 6; // Active fire frame
        context.entities.timeSeconds = 10;

        // Mock fire function that mimics the runtime checkAmmo behavior
        const fireShotgun = vi.fn((ent: Entity) => {
             // Mimic checkAmmo: if no ammo, call NoAmmoWeaponChange
             if (ent.client && ent.client.inventory.ammo.counts[AmmoType.Shells] < 1) {
                 NoAmmoWeaponChange(ent);
                 return;
             }
        });

        // Run Generic Think logic
        Weapon_Generic(
            player,
            5, // ACTIVATE_LAST
            15, // FIRE_LAST
            20, // IDLE_LAST
            25, // DEACTIVATE_LAST
            null,
            [6], // Fire frames
            fireShotgun,
            context.entities
        );

        expect(fireShotgun).toHaveBeenCalled();
        expect(NoAmmoWeaponChange).toHaveBeenCalled();
        // Should still be in firing state (playing "click" animation)
        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        // expect(player.client!.newWeapon).toBe('Blaster'); // Mock sets it

        // Advance frame to the end of firing sequence
        player.client!.gun_frame = 15; // FIRE_LAST
        context.entities.timeSeconds = 11; // Advance time

        Weapon_Generic(
            player,
            5, // ACTIVATE_LAST
            15, // FIRE_LAST
            20, // IDLE_LAST
            25, // DEACTIVATE_LAST
            null,
            [6], // Fire frames
            fireShotgun,
            context.entities
        );

        // Should switch now
        expect(ChangeWeapon).toHaveBeenCalled();
    });

});
