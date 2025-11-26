
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { WeaponId } from '../../src/inventory/playerInventory.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { createPlayerInventory } from '../../src/inventory/playerInventory.js';
import { createPlayerWeaponStates, getWeaponState } from '../../src/combat/weapons/state.js';
import * as damage from '../../src/combat/damage.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';

vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

describe('Weapon Firing Logic', () => {
    let mockGame: GameExports;
    let player: Entity;
    let target1: Entity;
    let target2: Entity;

    beforeEach(() => {
        vi.clearAllMocks();

        player = new Entity(0);
        Object.assign(player, {
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            velocity: { ...ZERO_VEC3 },
            client: {
                inventory: createPlayerInventory(),
                weaponStates: createPlayerWeaponStates(),
            },
        });

        target1 = new Entity(1);
        Object.assign(target1, {
            takedamage: true,
            health: 100,
            origin: { x: 100, y: 0, z: 0 },
        });

        target2 = new Entity(2);
        Object.assign(target2, {
            takedamage: true,
            health: 100,
            origin: { x: 200, y: 0, z: 0 },
        });

        mockGame = {
            time: 1.0,
            deathmatch: false,
            multicast: vi.fn(),
            trace: vi.fn(),
            sound: vi.fn(),
            entities: {
                world: new Entity(999)
            }
        } as unknown as GameExports;
    });

    describe('Chaingun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Bullets] = 10;
            const chaingunState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
            chaingunState.lastFireTime = 0;
            (mockGame.trace as any).mockReturnValue({ ent: target1, endpos: { x: 100, y: 0, z: 0 }, fraction: 0.5, plane: { normal: ZERO_VEC3 } });
        });

        it('should use single-player damage values', () => {
            mockGame.deathmatch = false;
            fire(mockGame, player, WeaponId.Chaingun);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                8, 1, DamageFlags.BULLET, DamageMod.CHAINGUN, mockGame.time, mockGame.multicast
            );
        });

        it('should use deathmatch damage values', () => {
            mockGame.deathmatch = true;
            fire(mockGame, player, WeaponId.Chaingun);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                6, 1, DamageFlags.BULLET, DamageMod.CHAINGUN, mockGame.time, mockGame.multicast
            );
        });
    });

    describe('Railgun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Slugs] = 10;
            const railgunState = getWeaponState(player.client!.weaponStates, WeaponId.Railgun);
            railgunState.lastFireTime = 0;
        });

        it('should penetrate multiple targets in SP', () => {
            (mockGame.trace as any)
                .mockReturnValueOnce({ ent: target1, endpos: { x: 100, y: 0, z: 0 }, fraction: 0.1, plane: { normal: ZERO_VEC3 } })
                .mockReturnValueOnce({ ent: target2, endpos: { x: 200, y: 0, z: 0 }, fraction: 0.2, plane: { normal: ZERO_VEC3 } })
                .mockReturnValueOnce({ ent: mockGame.entities.world, endpos: { x: 8192, y: 0, z: 0 }, fraction: 1.0, plane: { normal: ZERO_VEC3 } });

            fire(mockGame, player, WeaponId.Railgun);
            expect(damage.T_Damage).toHaveBeenCalledTimes(2);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                125, 225, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function)
            );
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target2, player, player, ZERO_VEC3, { x: 200, y: 0, z: 0 }, ZERO_VEC3,
                125, 225, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function)
            );
        });

        it('should penetrate multiple targets in DM', () => {
            mockGame.deathmatch = true;
            (mockGame.trace as any)
                .mockReturnValueOnce({ ent: target1, endpos: { x: 100, y: 0, z: 0 }, fraction: 0.1, plane: { normal: ZERO_VEC3 } })
                .mockReturnValueOnce({ ent: target2, endpos: { x: 200, y: 0, z: 0 }, fraction: 0.2, plane: { normal: ZERO_VEC3 } })
                .mockReturnValueOnce({ ent: mockGame.entities.world, endpos: { x: 8192, y: 0, z: 0 }, fraction: 1.0, plane: { normal: ZERO_VEC3 } });

            fire(mockGame, player, WeaponId.Railgun);
            expect(damage.T_Damage).toHaveBeenCalledTimes(2);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                100, 200, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function)
            );
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target2, player, player, ZERO_VEC3, { x: 200, y: 0, z: 0 }, ZERO_VEC3,
                100, 200, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function)
            );
        });
    });
});
