import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing';
import { GameExports } from '../../../src/index';
import { Entity } from '../../../src/entities/entity';
import { WeaponId } from '../../../src/inventory/playerInventory';
import { AmmoType } from '../../../src/inventory/ammo';
import { createPlayerInventory } from '../../../src/inventory/playerInventory';
import { createPlayerWeaponStates, getWeaponState } from '../../../src/combat/weapons/state';
import * as Damage from '../../../src/combat/damage';
import { ZERO_VEC3 } from '@quake2ts/shared';

describe('Railgun Firing Logic', () => {
    // Spy on the T_Damage function to verify the arguments passed to it
    const T_Damage_spy = vi.spyOn(Damage, 'T_Damage');

    let mockGame: GameExports;
    let player: Entity;
    let target: Entity;

    beforeEach(() => {
        // Mock the implementation to prevent the original function from running and causing side-effects
        T_Damage_spy.mockImplementation(() => {});

        player = {
            index: 0,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            velocity: { ...ZERO_VEC3 },
            client: {
                inventory: createPlayerInventory(),
                weaponStates: createPlayerWeaponStates(),
            },
        } as unknown as Entity;

        target = {
            takedamage: true,
            health: 100,
            velocity: { ...ZERO_VEC3 },
            origin: { x: 100, y: 0, z: 0 },
            mins: { x: -16, y: -16, z: -16 },
            maxs: { x: 16, y: 16, z: 16 },
        } as unknown as Entity;

        player.client!.inventory.ammo.counts[AmmoType.Slugs] = 10;

        // Correctly initialize the weapon state using the same logic as the game
        const railgunState = getWeaponState(player.client!.weaponStates, WeaponId.Railgun);
        railgunState.lastFireTime = 0;

        mockGame = {
            time: 1.0,
            deathmatch: false,
            multicast: vi.fn(),
            trace: vi.fn(),
            entities: {
                world: { index: 999 } as Entity
            }
        } as unknown as GameExports;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should use single-player damage and knockback values', () => {
        mockGame.deathmatch = false;
        (mockGame.trace as any)
            .mockReturnValueOnce({ fraction: 0.5, ent: target, endpos: { x: 100, y: 0, z: 0 }, plane: { normal: ZERO_VEC3 } })
            .mockReturnValue({ fraction: 1.0, ent: null, endpos: { x: 200, y: 0, z: 0 } });

        fire(mockGame, player, WeaponId.Railgun);

        expect(T_Damage_spy).toHaveBeenCalledWith(
            target,
            player,
            player,
            expect.any(Object),
            { x: 100, y: 0, z: 0 },
            ZERO_VEC3,
            125, // SP damage
            225, // SP knockback
            expect.any(Number),
            expect.any(Number),
            mockGame.multicast
        );
    });

    it('should use deathmatch damage and knockback values', () => {
        mockGame.deathmatch = true;
        (mockGame.trace as any)
            .mockReturnValueOnce({ fraction: 0.5, ent: target, endpos: { x: 100, y: 0, z: 0 }, plane: { normal: ZERO_VEC3 } })
            .mockReturnValue({ fraction: 1.0, ent: null, endpos: { x: 200, y: 0, z: 0 } });

        fire(mockGame, player, WeaponId.Railgun);

        expect(T_Damage_spy).toHaveBeenCalledWith(
            target,
            player,
            player,
            expect.any(Object),
            { x: 100, y: 0, z: 0 },
            ZERO_VEC3,
            100, // DM damage
            200, // DM knockback
            expect.any(Number),
            expect.any(Number),
            mockGame.multicast
        );
    });
});
