import { describe, it, expect, vi, beforeEach } from 'vitest';
import { grenadeThink } from '../../../../src/combat/weapons/grenade.js';
import { Entity } from '../../../../src/entities/entity.js';
import { EntitySystem } from '../../../../src/entities/system.js';
import { WeaponStateEnum } from '../../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../../src/inventory/ammo.js';
import { FRAME_GRENADE_THROW_FIRST, FRAME_GRENADE_THROW_HOLD, FRAME_GRENADE_THROW_FIRE } from '../../../../src/combat/weapons/frames.js';

describe('Grenade Think Logic', () => {
    let player: Entity;
    let sys: EntitySystem;
    let traceFn: any;
    let multicastFn: any;
    let spawnFn: any;
    let linkFn: any;

    beforeEach(() => {
        traceFn = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });
        multicastFn = vi.fn();
        spawnFn = vi.fn().mockReturnValue({ origin: { x:0, y:0, z:0 } });
        linkFn = vi.fn();

        sys = {
            timeSeconds: 100,
            trace: traceFn,
            spawn: spawnFn,
            linkEntity: linkFn,
            modelIndex: vi.fn().mockReturnValue(1),
            scheduleThink: vi.fn(),
            finalizeSpawn: vi.fn(),
            engine: {
                multicast: multicastFn
            }
        } as unknown as EntitySystem;

        player = {
            client: {
                weaponStates: {
                    states: new Map()
                },
                inventory: {
                    currentWeapon: WeaponId.HandGrenade,
                    ammo: {
                        counts: {
                            [AmmoType.Grenades]: 5
                        }
                    },
                    powerups: new Map()
                },
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: 0,
                buttons: 0,
                weapon_think_time: 0,
                kick_angles: { x: 0, y: 0, z: 0 },
                kick_origin: { x: 0, y: 0, z: 0 },
                v_angle: { x: 0, y: 0, z: 0 }
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            deadflag: 0
        } as unknown as Entity;
    });

    it('should start throw sequence when button is pressed in READY state', () => {
        player.client.buttons = 1; // Attack
        player.client.weaponstate = WeaponStateEnum.WEAPON_READY;

        grenadeThink(player, sys);

        expect(player.client.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client.gun_frame).toBe(FRAME_GRENADE_THROW_FIRST);
    });

    it('should hold grenade when button is held at HOLD frame', () => {
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = FRAME_GRENADE_THROW_HOLD;
        player.client.buttons = 1; // Held

        grenadeThink(player, sys);

        // Should stay at HOLD frame
        expect(player.client.gun_frame).toBe(FRAME_GRENADE_THROW_HOLD);
        // Should have set grenade timer
        expect(player.client.grenade_time).toBeGreaterThan(sys.timeSeconds);
    });

    it('should advance to throw fire when button is released at HOLD frame', () => {
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = FRAME_GRENADE_THROW_HOLD;
        player.client.buttons = 0; // Released
        // Ensure timer is set so we don't init it
        player.client.grenade_time = sys.timeSeconds + 3.0;

        grenadeThink(player, sys);

        // Logic fall-through:
        // 1. In HOLD frame (11), button released -> increments to 12.
        // 2. Continues to next block: In FIRE frame (12) -> fires -> increments to 13.
        expect(player.client.gun_frame).toBe(FRAME_GRENADE_THROW_FIRE + 1);
    });

    it('should throw grenade (consume ammo, etc) at FRAME_THROW_FIRE', () => {
        player.client.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client.gun_frame = FRAME_GRENADE_THROW_FIRE;
        player.client.buttons = 0;
        player.client.grenade_time = sys.timeSeconds + 2.0; // held for 1s

        // Mock createGrenade? It's imported.
        // We can't easily mock imported functions here without vi.mock.
        // But we can check side effects like ammo consumption.

        grenadeThink(player, sys);

        expect(player.client.inventory.ammo.counts[AmmoType.Grenades]).toBe(4);
        expect(player.client.gun_frame).toBe(FRAME_GRENADE_THROW_FIRE + 1);
        expect(multicastFn).toHaveBeenCalled(); // Muzzle flash
    });
});
