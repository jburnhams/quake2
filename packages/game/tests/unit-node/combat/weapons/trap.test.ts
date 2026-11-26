
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Trap_Think } from '../../../../src/combat/weapons/trap.js';
import { Entity } from '../../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import { AmmoType } from '../../../../src/inventory/ammo.js';

describe('Trap Weapon', () => {
    let context: ReturnType<typeof createTestContext>;
    let player: Entity;

    beforeEach(() => {
        context = createTestContext();
        player = new Entity(1);
        player.client = {
            inventory: {
                ammo: { counts: [] }
            },
            weaponstate: WeaponStateEnum.WEAPON_READY,
            gun_frame: 0,
            v_angle: { x: 0, y: 0, z: 0 },
            buttons: 0,
            grenade_time: 0
        } as any;
        player.client!.inventory.ammo.counts[AmmoType.Trap] = 10;

        // Mock engine on sys for P_ProjectSource
        const sys = context.entities;
        (sys as any).engine = {
            trace: sys.trace,
            sound: sys.sound,
        };
    });

    it('should start throw sequence when fired', () => {
        player.client!.buttons = 1; // Attack
        // FRAME_THROW_FIRST = 5

        Trap_Think(player, context.entities);

        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client!.gun_frame).toBe(5);
    });

    it('should hold charge', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = 11; // FRAME_THROW_HOLD
        player.client!.buttons = 1; // Still holding

        Trap_Think(player, context.entities);

        // Should stay on frame 11
        expect(player.client!.gun_frame).toBe(11);
        // Should set grenade_time
        expect(player.client!.grenade_time).toBeGreaterThan(0);
    });
});
