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

describe('Chaingun Firing Logic', () => {
    const T_Damage_spy = vi.spyOn(Damage, 'T_Damage');

    let mockGame: GameExports;
    let player: Entity;
    let target: Entity;

    beforeEach(() => {
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

        player.client!.inventory.ammo.counts[AmmoType.Bullets] = 10;
        const chaingunState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
        chaingunState.lastFireTime = 0;

        mockGame = {
            time: 1.0,
            deathmatch: false,
            multicast: vi.fn(),
            trace: vi.fn().mockReturnValue({
                fraction: 0.5,
                ent: target,
                endpos: { x: 100, y: 0, z: 0 },
                plane: { normal: ZERO_VEC3 }
            }),
        } as unknown as GameExports;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should use single-player damage values', () => {
        mockGame.deathmatch = false;

        fire(mockGame, player, WeaponId.Chaingun);

        expect(T_Damage_spy).toHaveBeenCalledWith(
            target,
            player,
            player,
            ZERO_VEC3,
            { x: 100, y: 0, z: 0 },
            ZERO_VEC3,
            8, // SP damage
            1,
            expect.any(Number),
            expect.any(Number),
            mockGame.multicast
        );
    });

    it('should use deathmatch damage values', () => {
        mockGame.deathmatch = true;

        fire(mockGame, player, WeaponId.Chaingun);

        expect(T_Damage_spy).toHaveBeenCalledWith(
            target,
            player,
            player,
            ZERO_VEC3,
            { x: 100, y: 0, z: 0 },
            ZERO_VEC3,
            6, // DM damage
            1,
            expect.any(Number),
            expect.any(Number),
            mockGame.multicast
        );
    });
});
