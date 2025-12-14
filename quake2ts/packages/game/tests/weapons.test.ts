
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameExports } from '../src';
import { Entity } from '../src/entities/entity';
import { WeaponId } from '../src/inventory/playerInventory';
import { AmmoType } from '../src/inventory/ammo';
import { DamageMod } from '../src/combat/damageMods';
import { fireBlaster, fireRailgunShot, fireChaingun, fireRocket, fireHyperBlaster, fireBFG } from '../src/combat/weapons/firing';
import { createBlasterBolt, createRocket, createBfgBall } from '../src/entities/projectiles';
import { fireRailgun } from '../src/combat/weapons/firing';
import { T_Damage } from '../src/combat/damage';

// Mock projectiles
vi.mock('../src/entities/projectiles', () => ({
    createBlasterBolt: vi.fn(),
    createRocket: vi.fn(),
    createGrenade: vi.fn(),
    createBfgBall: vi.fn()
}));

// Mock T_Damage
vi.mock('../src/combat/damage', () => ({
    T_Damage: vi.fn(),
    T_RadiusDamage: vi.fn()
}));

describe('Weapon Tests', () => {
    let mockGame: GameExports;
    let player: Entity;

    beforeEach(() => {
        vi.clearAllMocks();
        (T_Damage as any).mockClear();

        mockGame = {
            time: 100,
            deathmatch: false,
            multicast: vi.fn(),
            sound: vi.fn(),
            trace: vi.fn().mockReturnValue({
                fraction: 1.0,
                endpos: { x: 100, y: 0, z: 0 },
                ent: null
            }),
            entities: {
                world: { index: 0 }
            },
            random: {
                crandom: () => 0.5,
                frandom: () => 0.5,
                irandom: (max: number) => Math.floor(0.5 * max)
            }
        } as unknown as GameExports;

        player = {
            index: 1,
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            viewheight: 22,
            client: {
                inventory: {
                    ammo: {
                        counts: {
                            [AmmoType.Shells]: 100,
                            [AmmoType.Bullets]: 100,
                            [AmmoType.Cells]: 100,
                            [AmmoType.Rockets]: 100,
                            [AmmoType.Slugs]: 100,
                            [AmmoType.Grenades]: 100
                        }
                    },
                    ownedWeapons: new Set([WeaponId.Blaster, WeaponId.Shotgun, WeaponId.SuperShotgun, WeaponId.Machinegun, WeaponId.Chaingun, WeaponId.GrenadeLauncher, WeaponId.RocketLauncher, WeaponId.HyperBlaster, WeaponId.Railgun, WeaponId.BFG10K])
                },
                weaponStates: {
                    states: new Map()
                },
                kick_angles: { x: 0, y: 0, z: 0 },
                kick_origin: { x: 0, y: 0, z: 0 },
                pm_flags: 0,
                gun_frame: 0 // Legacy/Test mode
            }
        } as unknown as Entity;
    });

    describe('Blaster', () => {
        it('should fire with speed 1500', () => {
             fireBlaster(mockGame, player);
             expect(createBlasterBolt).toHaveBeenCalledWith(
                 expect.anything(),
                 player,
                 expect.anything(),
                 expect.anything(),
                 15, // damage
                 1500, // speed
                 DamageMod.BLASTER
             );
        });
    });

    describe('Railgun', () => {
        it('should deal 125 damage in single player', () => {
            mockGame.deathmatch = false;
            // We need trace to hit something
            const target = { takedamage: true };
            // Hit once then stop (fraction 1.0)
            (mockGame.trace as any)
                .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, ent: null }) // P_ProjectSource trace check
                .mockReturnValueOnce({
                    fraction: 0.5,
                    endpos: { x: 50, y: 0, z: 0 },
                    ent: target,
                    plane: { normal: { x: -1, y: 0, z: 0 } }
                })
                .mockReturnValue({
                    fraction: 1.0,
                    endpos: { x: 100, y: 0, z: 0 },
                    ent: null
                });

            fireRailgunShot(mockGame, player);

            expect(T_Damage).toHaveBeenCalledWith(
                target,
                player,
                player,
                expect.anything(),
                expect.anything(),
                expect.anything(),
                125, // damage
                225, // kick
                expect.anything(),
                DamageMod.RAILGUN,
                expect.anything(),
                expect.anything()
            );
        });

        it('should deal 100 damage in deathmatch', () => {
            mockGame.deathmatch = true;
            // We need trace to hit something
            const target = { takedamage: true };
            // Hit once then stop
            (mockGame.trace as any)
                .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, ent: null }) // P_ProjectSource trace check
                .mockReturnValueOnce({
                    fraction: 0.5,
                    endpos: { x: 50, y: 0, z: 0 },
                    ent: target,
                    plane: { normal: { x: -1, y: 0, z: 0 } }
                })
                .mockReturnValue({
                    fraction: 1.0,
                    endpos: { x: 100, y: 0, z: 0 },
                    ent: null
                });

            fireRailgunShot(mockGame, player);

            expect(T_Damage).toHaveBeenCalledWith(
                target,
                player,
                player,
                expect.anything(),
                expect.anything(),
                expect.anything(),
                100, // damage
                200, // kick
                expect.anything(),
                DamageMod.RAILGUN,
                expect.anything(),
                expect.anything()
            );
        });
    });

    describe('Chaingun', () => {
        it('should deal 8 damage in single player', () => {
             mockGame.deathmatch = false;
             // Ensure spinup count triggers shots
             // We'll manually inject weapon state if needed or rely on default behavior
             // fireChaingun implementation checks weaponState.lastFireTime.
             // We need to ensure shots > 0.

             // Mock trace hit
             const target = { takedamage: true };
             (mockGame.trace as any).mockReturnValue({
                 fraction: 0.5,
                 endpos: { x: 50, y: 0, z: 0 },
                 ent: target,
                 plane: { normal: { x: -1, y: 0, z: 0 } }
             });

             fireChaingun(mockGame, player);

             // Even with 1 shot, it should call T_Damage
             expect(T_Damage).toHaveBeenCalledWith(
                 target,
                 player,
                 player,
                 expect.anything(),
                 expect.anything(),
                 expect.anything(),
                 7, // damage (8 base, floor(7.9) with distance ~50)
                 1, // kick
                 expect.anything(),
                 DamageMod.CHAINGUN,
                 expect.anything(),
                 expect.anything()
             );
        });

        it('should deal 6 damage in deathmatch', () => {
             mockGame.deathmatch = true;

             // Mock trace hit
             const target = { takedamage: true };
             (mockGame.trace as any).mockReturnValue({
                 fraction: 0.5,
                 endpos: { x: 50, y: 0, z: 0 },
                 ent: target,
                 plane: { normal: { x: -1, y: 0, z: 0 } }
             });

             fireChaingun(mockGame, player);

             expect(T_Damage).toHaveBeenCalledWith(
                 target,
                 player,
                 player,
                 expect.anything(),
                 expect.anything(),
                 expect.anything(),
                 5, // damage (6 base, floor(5.9) with distance ~50)
                 1, // kick
                 expect.anything(),
                 DamageMod.CHAINGUN,
                 expect.anything(),
                 expect.anything()
             );
        });

        it('should burst 1->2->3 shots', () => {
            // This requires maintaining state across calls.
            // fireChaingun gets state from player.client.weaponStates

            // First shot (spinup 1) -> 1 shot + 1 source trace
            fireChaingun(mockGame, player);
            expect(mockGame.trace).toHaveBeenCalledTimes(2);

            (mockGame.trace as any).mockClear();

            // Second shot (spinup 2) -> 1 shot + 1 source trace
             fireChaingun(mockGame, player);
            expect(mockGame.trace).toHaveBeenCalledTimes(2);

             (mockGame.trace as any).mockClear();

            // 3, 4, 5 -> 1 shot + 1 source trace each = 3 * 2 = 6
            fireChaingun(mockGame, player); // 3
            fireChaingun(mockGame, player); // 4
            fireChaingun(mockGame, player); // 5
            expect(mockGame.trace).toHaveBeenCalledTimes(6);

             (mockGame.trace as any).mockClear();

            // 6 -> 2 shots + 1 source trace = 3
            fireChaingun(mockGame, player);
            expect(mockGame.trace).toHaveBeenCalledTimes(3);

             (mockGame.trace as any).mockClear();

            // ... skip to 11
             for(let i=0; i<4; i++) fireChaingun(mockGame, player); // 7, 8, 9, 10
             (mockGame.trace as any).mockClear();

             // 11 -> 3 shots + 1 source trace = 4
             fireChaingun(mockGame, player);
             expect(mockGame.trace).toHaveBeenCalledTimes(4);
        });
    });

    describe('Rocket Launcher', () => {
        it('should deal random damage 100-120 and 120 radius', () => {
            // Mock irandom to return a known value
            const randomSpy = vi.spyOn(mockGame.random, 'irandom').mockReturnValue(10); // 100 + 10 = 110

            fireRocket(mockGame, player);

            expect(createRocket).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                110, // damage (100 + 10)
                120, // radius damage
                650 // speed
            );
        });
    });

    describe('HyperBlaster', () => {
         it('should deal 20 damage in single player', () => {
            mockGame.deathmatch = false;
            fireHyperBlaster(mockGame, player);

            expect(createBlasterBolt).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                20, // damage
                1000, // speed
                DamageMod.HYPERBLASTER
            );
         });

         it('should deal 15 damage in deathmatch', () => {
            mockGame.deathmatch = true;
            fireHyperBlaster(mockGame, player);

            expect(createBlasterBolt).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                15, // damage
                1000, // speed
                DamageMod.HYPERBLASTER
            );
         });
    });

    describe('BFG10K', () => {
        it('should deal 500 damage in single player', () => {
            mockGame.deathmatch = false;
            player.client!.gun_frame = 22; // Fire frame

            fireBFG(mockGame, player);

            expect(createBfgBall).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                500, // damage
                400, // speed
                200 // radius
            );
        });

        it('should deal 200 damage in deathmatch', () => {
            mockGame.deathmatch = true;
            player.client!.gun_frame = 22; // Fire frame

            fireBFG(mockGame, player);

            expect(createBfgBall).toHaveBeenCalledWith(
                expect.anything(),
                player,
                expect.anything(),
                expect.anything(),
                200, // damage
                400, // speed
                200 // radius
            );
        });
    });
});
