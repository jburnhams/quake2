// =================================================================
// Quake II - Chaingun Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { GameExports } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { Entity } from '../../src/entities/entity.js';
import { chaingunThink } from '../../src/combat/weapons/chaingun.js';
import { getWeaponState } from '../../src/combat/weapons/state.js';
import { WeaponStateEnum } from '../../src/combat/weapons/state.js';
import { createTestContext, createPlayerEntityFactory, createEntityFactory, spawnEntity } from '@quake2ts/test-utils';

describe('Chaingun', () => {
    let game: GameExports;
    let player: Entity;
    let target: Entity;
    let trace: any;
    let T_Damage: any;
    let engine: any;
    let entities: any;
    let imports: any;

    beforeEach(() => {
        T_Damage = vi.spyOn(damage, 'T_Damage');

        const context = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });
        game = context.game;
        entities = context.entities;
        engine = context.engine;
        imports = context.imports;
        trace = imports.trace;

        game.spawnWorld();

        player = spawnEntity(entities, createPlayerEntityFactory({
            classname: 'player',
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        }));

        if (!player.client) player.client = {} as any;
        Object.assign(player.client!, {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Chaingun],
                ammo: { [AmmoType.Bullets]: 50 },
            }),
            weaponStates: { states: new Map() },
            buttons: 0,
            gun_frame: 0,
            weaponstate: WeaponStateEnum.WEAPON_READY,
            kick_angles: {x: 0, y: 0, z: 0},
            kick_origin: {x: 0, y: 0, z: 0},
        });

        target = spawnEntity(entities, createEntityFactory({
            health: 100,
            takedamage: true
        }));

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
            fraction: 0.1,
            startsolid: false,
            allsolid: false
        });
    });

    it('should consume 1 bullet and deal 7 damage in SP', () => {
        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(2); // 1 for P_ProjectSource + 1 for bullet
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            7, // SP damage (8 base, floor(7.98) due to 10 unit distance)
            expect.anything(),
            expect.anything(),
            DamageMod.CHAINGUN,
            expect.anything(), // time
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });

    it('should consume 1 bullet and deal 5 damage in DM', () => {
        Object.defineProperty(game, 'deathmatch', { value: true });

        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(2); // 1 for P_ProjectSource + 1 for bullet

        expect(T_Damage).toHaveBeenCalledWith(
            target,
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            5, // DM damage (falloff applied)
            expect.anything(),
            expect.anything(),
            DamageMod.CHAINGUN,
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });

    describe('Spin-up Mechanic', () => {
        it('should increase shots fired during continuous fire', () => {
            const context = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });
            const game = context.game;
            const entities = context.entities;
            const imports = context.imports;
            const trace = imports.trace;

            let currentTime = 0;
            Object.defineProperty(game, 'time', { get: () => currentTime });
            Object.defineProperty(entities, 'timeSeconds', { get: () => currentTime });

            const advanceTime = (ms: number) => {
                currentTime += ms / 1000;
            };

            game.spawnWorld();

            const player = spawnEntity(entities, createPlayerEntityFactory({
                classname: 'player',
                angles: { x: 0, y: 0, z: 0 },
                origin: { x: 0, y: 0, z: 0 }
            }));

            if (!player.client) player.client = {} as any;
            Object.assign(player.client!, {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Chaingun],
                    ammo: { [AmmoType.Bullets]: 200 },
                }),
                weaponStates: { states: new Map() },
                kick_angles: {x: 0, y: 0, z: 0},
                kick_origin: {x: 0, y: 0, z: 0},
                buttons: 1, // Attack
                gun_frame: 0,
                weaponstate: WeaponStateEnum.WEAPON_READY
            });

            const target = spawnEntity(entities, createEntityFactory({
                health: 1000,
                takedamage: true
            }));

            trace.mockReturnValue({
                ent: target,
                endpos: { x: 10, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0 },
                fraction: 0.1,
                startsolid: false,
                allsolid: false
            });

            let totalTraceCalls = 0;
            let ammoConsumed = 0;

            // Stage 1: Spinup 1-5 (5 iter)
            // shots=1 per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 2; // 1 source + 1 shot
                ammoConsumed += 1;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                advanceTime(100);
            }
            // spinupCount is now 5.

            // Stage 2: Spinup 6-10 (5 iter)
            // shots=2 per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 3; // 1 source + 2 shots
                ammoConsumed += 2;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                advanceTime(100);
            }
            // spinupCount is now 10.

            // Stage 3: Spinup 11-15 (5 iter)
            // shots=3 per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 4; // 1 source + 3 shots
                ammoConsumed += 3;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                advanceTime(100);
            }

            // --- Test reset after a pause ---
            // The code uses `game.time` (seconds) > 200.
            // So we need to advance > 200 seconds.
            advanceTime(250000);

            fire(game, player, WeaponId.Chaingun);
            totalTraceCalls += 2; // Should reset to 1 shot
            ammoConsumed += 1;
            expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
            expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
        });
    });

    describe('Wind-up Mode (Alt-Fire)', () => {
        it('should spin up without firing when Alt-Fire is held', () => {
             // Arrange
             player.client!.buttons = 32; // Attack2
             const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
             weaponState.spinupCount = 0;
             const initialAmmo = player.client!.inventory.ammo.counts[AmmoType.Bullets];

             // Act - multiple frames
             for (let i = 0; i < 20; i++) {
                 chaingunThink(player, entities);
             }

             // Assert
             expect(weaponState.spinupCount).toBeGreaterThan(15);
             expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(initialAmmo); // No ammo consumed
             expect(engine.sound).toHaveBeenCalledWith(player, 0, expect.stringContaining('weapons/chngn'), expect.anything(), expect.anything(), expect.anything());
        });

        it('should fire immediately at high rate if Fire is pressed while wound up', () => {
             // Arrange
             player.client!.buttons = 32; // Attack2
             const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);

             // Mock timing
             let mockTime = 1000;
             Object.defineProperty(game, 'time', { get: () => mockTime });
             Object.defineProperty(entities, 'timeSeconds', { get: () => mockTime / 1000 });

             // Spin up first
             for (let i = 0; i < 20; i++) {
                 chaingunThink(player, entities);
             }
             const woundUpCount = weaponState.spinupCount!;
             expect(woundUpCount).toBeGreaterThan(10);

             // Now press Fire (Attack + Attack2)
             player.client!.buttons = 1 | 32;

             // Clear mocks to check fire
             trace.mockClear();

             // 1st tick: Transitions to FIRING state
             chaingunThink(player, entities);
             expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);

             // 2nd tick: Should fire
             // Advance time by 0.1s (100ms)
             mockTime += 100;

             chaingunThink(player, entities);

             // Assert
             // fireChaingun increments spinupCount by 1 more
             expect(weaponState.spinupCount).toBe(woundUpCount + 1);

             // Check if it fired 3 shots (because spinup > 10)
             // 1 trace for ProjectSource, 3 for bullets = 4 traces
             expect(trace).toHaveBeenCalledTimes(4);
             expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(47); // 50 - 3
        });

         it('should spin down when Alt-Fire is released', () => {
            // Arrange
            player.client!.buttons = 0; // Released
            const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);
            weaponState.spinupCount = 10;

            // Act
            chaingunThink(player, entities);

            // Assert
            expect(weaponState.spinupCount).toBe(0);
            expect(engine.sound).toHaveBeenCalledWith(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        });
    });
});
