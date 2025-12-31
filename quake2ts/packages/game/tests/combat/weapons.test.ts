import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { GameExports } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { WeaponId, createPlayerInventory } from '../../src/inventory/playerInventory.js';
import { AmmoType } from '../../src/inventory/ammo.js';
import { createPlayerWeaponStates, getWeaponState } from '../../src/combat/weapons/state.js';
import * as damage from '../../src/combat/damage.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createMockGameExports } from '@quake2ts/test-utils/game/helpers';
import { createTraceMock } from '@quake2ts/test-utils/shared/collision';
import { createPlayerEntityFactory } from '@quake2ts/test-utils/game/factories';
import { createEntityFactory } from '@quake2ts/test-utils';

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

        // Use test-utils factories
        const playerData = createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            velocity: { ...ZERO_VEC3 },
            number: 0
        });

        player = new Entity(0);
        Object.assign(player, playerData);

        // Ensure client side is set up with proper types
        if (!player.client) {
             player.client = {
                 inventory: createPlayerInventory(),
                 weaponStates: createPlayerWeaponStates(),
                 ps: {} as any
             } as any;
        }

        const targetData = createEntityFactory({
             takedamage: true,
             health: 100,
             origin: { x: 100, y: 0, z: 0 },
        });
        target1 = new Entity(1);
        Object.assign(target1, targetData);

        const target2Data = createEntityFactory({
            takedamage: true,
            health: 100,
            origin: { x: 200, y: 0, z: 0 },
        });
        target2 = new Entity(2);
        Object.assign(target2, target2Data);

        // Use createMockGameExports from test-utils
        mockGame = createMockGameExports({
            time: 1.0,
            deathmatch: false,
            multicast: vi.fn(),
            trace: vi.fn(),
            sound: vi.fn(),
            entities: {
                world: new Entity(999),
                activeCount: 0
            } as any,
            hooks: { onDamage: vi.fn() } as any
        });
    });

    describe('Chaingun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Bullets] = 10;
            const chaingunState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
            chaingunState.lastFireTime = 0;
        });

        it('should use single-player damage values (no significant falloff at close range)', () => {
            mockGame.deathmatch = false;
            // Mock trace to hit.
            (mockGame.trace as any).mockReturnValue(createTraceMock({
                ent: target1,
                endpos: { x: 100, y: 0, z: 0 },
                fraction: 0.5
            }));

            fire(mockGame, player, WeaponId.Chaingun);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                7, 1, DamageFlags.BULLET, DamageMod.CHAINGUN, mockGame.time, mockGame.multicast, { hooks: mockGame.hooks }
            );
        });

        it('should use deathmatch damage values', () => {
            mockGame.deathmatch = true;
            (mockGame.trace as any).mockReturnValue(createTraceMock({
                ent: target1,
                endpos: { x: 100, y: 0, z: 0 },
                fraction: 0.5
            }));

            fire(mockGame, player, WeaponId.Chaingun);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                5, 1, DamageFlags.BULLET, DamageMod.CHAINGUN, mockGame.time, mockGame.multicast, { hooks: mockGame.hooks }
            );
        });

        it('should apply falloff at range', () => {
            mockGame.deathmatch = false;
            (mockGame.trace as any).mockReturnValue(createTraceMock({
                ent: target1,
                endpos: { x: 1000, y: 0, z: 0 },
                fraction: 0.5
            }));

            fire(mockGame, player, WeaponId.Chaingun);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 1000, y: 0, z: 0 }, ZERO_VEC3,
                7, 1, DamageFlags.BULLET, DamageMod.CHAINGUN, mockGame.time, mockGame.multicast, { hooks: mockGame.hooks }
            );
        });
    });

    describe('Machinegun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Bullets] = 10;
        });

        it('should apply falloff at range (80% at 1000 units)', () => {
            mockGame.deathmatch = false;
            (mockGame.trace as any).mockReturnValue(createTraceMock({
                ent: target1,
                endpos: { x: 1000, y: 0, z: 0 },
                fraction: 0.5
            }));

            fire(mockGame, player, WeaponId.Machinegun);
             expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 1000, y: 0, z: 0 }, ZERO_VEC3,
                7, 1, DamageFlags.BULLET, DamageMod.MACHINEGUN, mockGame.time, mockGame.multicast, { hooks: mockGame.hooks }
            );
        });
    });

    describe('Shotgun', () => {
        beforeEach(() => {
            player.client!.inventory.ammo.counts[AmmoType.Shells] = 10;
        });

        it('should NOT apply falloff at range (Shotgun has no falloff in Q2)', () => {
            mockGame.deathmatch = false;
            (mockGame.trace as any).mockReturnValue(createTraceMock({
                ent: target1,
                endpos: { x: 1000, y: 0, z: 0 },
                fraction: 0.5
            }));

            fire(mockGame, player, WeaponId.Shotgun);

            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 1000, y: 0, z: 0 }, ZERO_VEC3,
                4, 1, DamageFlags.BULLET, DamageMod.SHOTGUN, mockGame.time, mockGame.multicast, { hooks: mockGame.hooks }
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
                .mockReturnValueOnce(createTraceMock({ ent: null, endpos: { x: 0, y: 0, z: 0 }, fraction: 1.0 })) // P_ProjectSource
                .mockReturnValueOnce(createTraceMock({ ent: target1, endpos: { x: 100, y: 0, z: 0 }, fraction: 0.1 }))
                .mockReturnValueOnce(createTraceMock({ ent: target2, endpos: { x: 200, y: 0, z: 0 }, fraction: 0.2 }))
                .mockReturnValueOnce(createTraceMock({ ent: mockGame.entities.world, endpos: { x: 8192, y: 0, z: 0 }, fraction: 1.0 }));

            fire(mockGame, player, WeaponId.Railgun);
            expect(damage.T_Damage).toHaveBeenCalledTimes(2);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                125, 225, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function), { hooks: mockGame.hooks }
            );
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target2, player, player, ZERO_VEC3, { x: 200, y: 0, z: 0 }, ZERO_VEC3,
                125, 225, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function), { hooks: mockGame.hooks }
            );
        });

        it('should penetrate multiple targets in DM', () => {
            mockGame.deathmatch = true;
            (mockGame.trace as any)
                .mockReturnValueOnce(createTraceMock({ ent: null, endpos: { x: 0, y: 0, z: 0 }, fraction: 1.0 })) // P_ProjectSource
                .mockReturnValueOnce(createTraceMock({ ent: target1, endpos: { x: 100, y: 0, z: 0 }, fraction: 0.1 }))
                .mockReturnValueOnce(createTraceMock({ ent: target2, endpos: { x: 200, y: 0, z: 0 }, fraction: 0.2 }))
                .mockReturnValueOnce(createTraceMock({ ent: mockGame.entities.world, endpos: { x: 8192, y: 0, z: 0 }, fraction: 1.0 }));

            fire(mockGame, player, WeaponId.Railgun);
            expect(damage.T_Damage).toHaveBeenCalledTimes(2);
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target1, player, player, ZERO_VEC3, { x: 100, y: 0, z: 0 }, ZERO_VEC3,
                100, 200, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function), { hooks: mockGame.hooks }
            );
            expect(damage.T_Damage).toHaveBeenCalledWith(
                target2, player, player, ZERO_VEC3, { x: 200, y: 0, z: 0 }, ZERO_VEC3,
                100, 200, DamageFlags.ENERGY, DamageMod.RAILGUN, mockGame.time, expect.any(Function), { hooks: mockGame.hooks }
            );
        });
    });
});
