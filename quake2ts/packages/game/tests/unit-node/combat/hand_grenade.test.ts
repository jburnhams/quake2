import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../../src/entities/entity.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { GameExports } from '../../../src/index.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { WeaponId } from '../../../src/inventory/playerInventory.js';
import { AmmoType } from '../../../src/inventory/ammo.js';
import {
    FRAME_GRENADE_PRIME_SOUND,
    FRAME_GRENADE_THROW_HOLD,
    FRAME_GRENADE_THROW_FIRE,
    FRAME_GRENADE_THROW_FIRST
} from '../../../src/combat/weapons/frames.js';
import { fireHandGrenade } from '../../../src/combat/weapons/firing.js';
import { createMockGameExports, createPlayerEntityFactory, createPlayerStateFactory } from '@quake2ts/test-utils';

describe('Hand Grenade Combat Logic', () => {
    let sys: EntitySystem;
    let game: GameExports;
    let player: Entity;

    beforeEach(() => {
        // Create Mock GameExports
        game = createMockGameExports({
            time: 10.0,
            trace: vi.fn().mockReturnValue({
                fraction: 1.0,
                endpos: { x: 0, y: 0, z: 0 },
                ent: null
            }),
            entities: {
                spawn: vi.fn(() => new Entity(2)),
                sound: vi.fn(),
                timeSeconds: 10.0,
                modelIndex: vi.fn(() => 1),
                linkentity: vi.fn(),
                scheduleThink: vi.fn(),
                finalizeSpawn: vi.fn(),
                // Add required properties for internal logic if needed,
                // but for this test these mocks seem sufficient based on original code.
            } as unknown as EntitySystem
        });

        // Helper sys alias
        sys = game.entities as unknown as EntitySystem;

        // Mock Player
        // We use createPlayerEntityFactory and then merge/assign specific properties.
        const playerBase = createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 }
        });

        // We need to cast playerBase back to Entity or use it as base.
        // Since createPlayerEntityFactory returns Partial<Entity>, we cast it or use Object.assign on a new Entity if strictness matters.
        // But here we can just treat it as Entity for the test context.
        player = playerBase as Entity;
        player.index = 1;

        // Populate client state
        player.client = {
            ...createPlayerStateFactory({
                weaponstate: WeaponStateEnum.WEAPON_READY,
                gun_frame: 0,
                // weapon_think_time: 0, // Not in PlayerState interface? Check if it is on PlayerClient.
                // buttons: 0,
                // pm_flags: 0,
            }),
            weapon_think_time: 0,
            buttons: 0,
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
            grenade_time: 0,
            grenade_blew_up: false
        } as any; // Cast to any or PlayerClient if imports allow
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
