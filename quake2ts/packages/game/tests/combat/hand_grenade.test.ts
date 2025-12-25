import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { GameExports } from '../../src/index.js';
import { WeaponStateEnum } from '../../src/combat/weapons/state.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import {
    FRAME_GRENADE_PRIME_SOUND,
    FRAME_GRENADE_THROW_HOLD,
    FRAME_GRENADE_THROW_FIRE,
    FRAME_GRENADE_THROW_FIRST
} from '../../src/combat/weapons/frames.js';
import { fireHandGrenade } from '../../src/combat/weapons/firing.js';

describe('Hand Grenade Combat Logic', () => {
    let sys: EntitySystem;
    let game: GameExports;
    let player: Entity;

    beforeEach(() => {
        // Mock EntitySystem inside GameExports
        const entitiesMock = {
            spawn: vi.fn(() => new Entity(2)),
            sound: vi.fn(),
            timeSeconds: 10.0,
            modelIndex: vi.fn(() => 1),
            linkentity: vi.fn(),
            scheduleThink: vi.fn(),
            finalizeSpawn: vi.fn(),
        } as unknown as EntitySystem;

        // Mock GameExports
        game = {
            time: 10.0,
            trace: vi.fn().mockReturnValue({
                fraction: 1.0,
                endpos: { x: 0, y: 0, z: 0 },
                ent: null
            }),
            multicast: vi.fn(),
            sound: vi.fn(),
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5,
                irandom: () => 100,
            },
            entities: entitiesMock, // Pass the entities mock here
        } as unknown as GameExports;

        // Helper sys (same as game.entities for consistency in expectation checks if needed)
        sys = entitiesMock;

        // Mock Player
        player = {
            client: {
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: 0,
                weapon_think_time: 0,
                buttons: 0,
                pm_flags: 0, // Mock pm_flags for animation check
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Grenades]: 5,
                        },
                    },
                    powerups: new Map(),
                    weaponStates: {
                        [WeaponId.HandGrenade]: { lastFireTime: 0 }
                    }
                },
                angles: { x: 0, y: 0, z: 0 },
            },
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            index: 1,
        } as unknown as Entity;
    });

    it('should start throw sequence on fire button', () => {
        // Press fire button
        player.client!.buttons = 1; // BUTTON_ATTACK

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_FIRST);
    });

    it('should play prime sound at correct frame', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = FRAME_GRENADE_PRIME_SOUND - 1;
        player.client!.buttons = 1;

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_PRIME_SOUND);
        expect(sys.sound).toHaveBeenCalledWith(player, 0, 'weapons/hgrena1b.wav', 1, 1, 0);
    });

    it('should hold at FRAME_THROW_HOLD while button pressed', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = FRAME_GRENADE_THROW_HOLD;
        player.client!.buttons = 1; // Still holding
        player.client!.grenade_time = sys.timeSeconds + 3.0; // Fuse set

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        // Should NOT advance frame
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_HOLD);
    });

    it('should advance to throw frame when button released', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = FRAME_GRENADE_THROW_HOLD;
        player.client!.buttons = 0; // Released

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        // Should fall through hold -> fire -> post-fire in one tick
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_FIRE + 1); // 13
    });

    it('should fire (throw) when reaching FRAME_THROW_FIRE', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = FRAME_GRENADE_THROW_FIRE;

        const multicastSpy = vi.spyOn(game, 'multicast');

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        // Should trigger muzzle flash
        expect(multicastSpy).toHaveBeenCalled();
        expect(player.client!.gun_frame).toBe(FRAME_GRENADE_THROW_FIRE + 1);
    });

    it('should explode in hand if held too long', () => {
        player.client!.weaponstate = WeaponStateEnum.WEAPON_FIRING;
        player.client!.gun_frame = FRAME_GRENADE_THROW_HOLD;
        player.client!.buttons = 1;
        player.client!.grenade_time = sys.timeSeconds - 0.1; // Expired

        const multicastSpy = vi.spyOn(game, 'multicast');

        fireHandGrenade(
            game,
            player,
            player.client!.inventory,
            player.client!.inventory.weaponStates[WeaponId.HandGrenade]
        );

        // Should explode
        expect(multicastSpy).toHaveBeenCalled(); // At least one multicast for explosion
        expect(player.client!.grenade_blew_up).toBe(true);
    });
});
