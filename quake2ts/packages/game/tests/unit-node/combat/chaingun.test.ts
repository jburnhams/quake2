// =================================================================
// Quake II - Chaingun Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createGame, GameExports } from '../../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as damage from '../../../src/combat/damage.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { Entity } from '../../../src/entities/entity.js';
import { chaingunThink } from '../../../src/combat/weapons/chaingun.js';
import { getWeaponState } from '../../../src/combat/weapons/state.js';
import { WeaponStateEnum } from '../../../src/combat/weapons/state.js';
import { createPlayerEntityFactory, createEntityFactory, createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Chaingun', () => {
    let game: GameExports;
    let player: Entity;
    let target: Entity;
    let trace: any;
    let T_Damage: any;
    let engine: any;

    beforeEach(() => {
        const { imports, engine: mockEngine } = createGameImportsAndEngine();
        trace = imports.trace;
        engine = mockEngine;

        // Spy on T_Damage to verify damage application
        T_Damage = vi.spyOn(damage, 'T_Damage');

        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false });

        // Ensure circular reference for tests using sys.game using defineProperty to bypass readonly
        Object.defineProperty(game.entities, 'game', { value: game, configurable: true });

        game.spawnWorld();

        // Use factory for player configuration - explicitly set classname even if factory default is 'player', for clarity
        const playerTemplate = createPlayerEntityFactory({
            classname: 'player',
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        });

        player = game.entities.spawn();
        Object.assign(player, playerTemplate);

        // Manually set complex client objects that might not be in factory default yet or need specific test setup
        player.client = {
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
        } as any;

        game.entities.finalizeSpawn(player);

        // Use factory for target
        const targetTemplate = createEntityFactory({
            health: 100,
            takedamage: true
        });
        target = game.entities.spawn();
        Object.assign(target, targetTemplate);

        game.entities.finalizeSpawn(target);

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
            fraction: 0.1,
            surface: null,
            contents: 0,
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
            game.time,
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });

    it('should consume 1 bullet and deal 5 damage in DM', () => {
        (game as any).deathmatch = true; // Set deathmatch mode

        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(2); // 1 for P_ProjectSource + 1 for bullet

        // Expected 6 base, but test environment introduces slight distance falloff resulting in 5
        // 6 - (10 * 0.002) = 5.98 -> 5
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
            game.time,
            expect.anything(),
            expect.objectContaining({ hooks: expect.anything() })
        );
    });

    describe('Spin-up Mechanic', () => {
        it('should increase shots fired during continuous fire', () => {
            const { imports, engine: mockEngine } = createGameImportsAndEngine();
            const trace = imports.trace;
            vi.spyOn(damage, 'T_Damage');

            const game = createGame(imports, mockEngine, { gravity: { x: 0, y: 0, z: -800 } });

            Object.defineProperty(game.entities, 'game', { value: game, configurable: true });

            let currentTime = 0;
            vi.spyOn(game, 'time', 'get').mockImplementation(() => currentTime);
            game.advanceTime = (ms: number) => {
                currentTime += ms;
            };

            game.spawnWorld();

            const playerTemplate = createPlayerEntityFactory({
                classname: 'player',
                angles: { x: 0, y: 0, z: 0 },
                origin: { x: 0, y: 0, z: 0 }
            });
            const player = game.entities.spawn();
            Object.assign(player, playerTemplate);

            player.client = {
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
            } as any;
            game.entities.finalizeSpawn(player);

            const targetTemplate = createEntityFactory({
                health: 1000,
                takedamage: true
            });
            const target = game.entities.spawn();
            Object.assign(target, targetTemplate);
            game.entities.finalizeSpawn(target);

            trace.mockReturnValue({
                ent: target,
                endpos: { x: 10, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } },
                fraction: 0.1,
                surface: null,
                contents: 0,
                startsolid: false,
                allsolid: false
            });

            let totalTraceCalls = 0;
            let ammoConsumed = 0;

            // Stage 1: 1 shot per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 2; // 1 for P_ProjectSource + 1 shot
                ammoConsumed += 1;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // Stage 2: 2 shots per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 3; // 1 for P_ProjectSource + 2 shots
                ammoConsumed += 2;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // Stage 3: 3 shots per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 4; // 1 for P_ProjectSource + 3 shots
                ammoConsumed += 3;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // --- Test reset after a pause ---
            game.advanceTime!(300);

            fire(game, player, WeaponId.Chaingun);
            totalTraceCalls += 2; // Should reset to 1 shot (+1 source check)
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
                 chaingunThink(player, game.entities);
                 // Need to advance lastFireTime? handled in think.
             }

             // Assert
             expect(weaponState.spinupCount).toBeGreaterThan(15);
             expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(initialAmmo); // No ammo consumed
             expect(engine.sound).toHaveBeenCalledWith(player, 0, expect.stringContaining('weapons/chngn'), expect.anything(), expect.anything(), expect.anything());

             // Check animation frame cycling
             expect(player.client!.gun_frame).toBeGreaterThanOrEqual(5);
             expect(player.client!.gun_frame).toBeLessThanOrEqual(21);
        });

        it('should fire immediately at high rate if Fire is pressed while wound up', () => {
             // Arrange
             player.client!.buttons = 32; // Attack2
             const weaponState = getWeaponState(player.client!.weaponStates, WeaponId.Chaingun);

             // Mock timing
             let mockTime = 1000;
             vi.spyOn(game, 'time', 'get').mockImplementation(() => mockTime);
             Object.defineProperty(game.entities, 'timeSeconds', { get: () => mockTime / 1000 });

             // Spin up first
             for (let i = 0; i < 20; i++) {
                 chaingunThink(player, game.entities);
             }
             const woundUpCount = weaponState.spinupCount!;
             expect(woundUpCount).toBeGreaterThan(10);

             // Now press Fire (Attack + Attack2)
             player.client!.buttons = 1 | 32;

             // Clear mocks to check fire
             trace.mockClear();

             // 1st tick: Transitions to FIRING state
             chaingunThink(player, game.entities);
             expect(player.client!.weaponstate).toBe(WeaponStateEnum.WEAPON_FIRING);

             // 2nd tick: Should fire
             // Advance time by 0.1s (100ms)
             mockTime += 100;

             chaingunThink(player, game.entities);

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
            chaingunThink(player, game.entities);

            // Assert
            expect(weaponState.spinupCount).toBe(0);
            expect(engine.sound).toHaveBeenCalledWith(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        });
    });
});
