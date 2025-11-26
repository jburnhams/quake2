// =================================================================
// Quake II - Chaingun Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame, GameExports } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { Entity } from '../../src/entities/entity.js';

describe('Chaingun', () => {
    let game: GameExports;
    let player: Entity;
    let target: Entity;
    let trace: any;
    let T_Damage: any;

    beforeEach(() => {
        const multicast = vi.fn();
        trace = vi.fn();
        T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };

        game = createGame({ trace, multicast, pointcontents: vi.fn(), unicast: vi.fn(), linkentity: vi.fn() }, engine, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: false });

        game.spawnWorld();

        player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Chaingun],
                ammo: { [AmmoType.Bullets]: 50 },
            }),
            weaponStates: { states: new Map() },
        } as any;
        player.angles = { x: 0, y: 0, z: 0 };
        player.origin = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(player);

        target = game.entities.spawn();
        target.health = 100;
        target.takedamage = true;
        game.entities.finalizeSpawn(target);

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });
    });

    it('should consume 1 bullet and deal 8 damage in SP', () => {
        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(1);
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            8, // SP damage
            expect.anything(),
            expect.anything(),
            DamageMod.CHAINGUN,
            expect.anything()
        );
    });

    it('should consume 1 bullet and deal 6 damage in DM', () => {
        (game as any).deathmatch = true; // Set deathmatch mode

        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(1);
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            expect.anything(),
            player,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            6, // DM damage
            expect.anything(),
            expect.anything(),
            DamageMod.CHAINGUN,
            expect.anything()
        );
    });

    describe('Spin-up Mechanic', () => {
        it('should increase shots fired during continuous fire', () => {
            const trace = vi.fn();
            const multicast = vi.fn();
            const sound = vi.fn();
            vi.spyOn(damage, 'T_Damage');

            const game = createGame({ trace, multicast, sound, pointcontents: vi.fn(), linkentity: vi.fn(), unicast: vi.fn() }, {
                sound: vi.fn(),
                centerprintf: vi.fn(),
                modelIndex: vi.fn(),
            }, { gravity: { x: 0, y: 0, z: -800 } });

            let currentTime = 0;
            vi.spyOn(game, 'time', 'get').mockImplementation(() => currentTime);
            game.advanceTime = (ms: number) => {
                currentTime += ms;
            };

            game.spawnWorld();

            const player = game.entities.spawn();
            player.classname = 'player';
            player.client = {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Chaingun],
                    ammo: { [AmmoType.Bullets]: 200 },
                }),
                weaponStates: { states: new Map() },
                kick_angles: {x: 0, y: 0, z: 0},
                kick_origin: {x: 0, y: 0, z: 0},
            } as any;
            player.angles = { x: 0, y: 0, z: 0 };
            player.origin = { x: 0, y: 0, z: 0 };
            game.entities.finalizeSpawn(player);

            const target = game.entities.spawn();
            target.health = 1000;
            target.takedamage = 1;
            game.entities.finalizeSpawn(target);

            trace.mockReturnValue({
                ent: target,
                endpos: { x: 10, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } },
                fraction: 0.1
            });

            let totalTraceCalls = 0;
            let ammoConsumed = 0;

            // Stage 1: 1 shot per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 1;
                ammoConsumed += 1;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // Stage 2: 2 shots per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 2;
                ammoConsumed += 2;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // Stage 3: 3 shots per fire
            for (let i = 1; i <= 5; i++) {
                fire(game, player, WeaponId.Chaingun);
                totalTraceCalls += 3;
                ammoConsumed += 3;
                expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
                expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
                game.advanceTime!(100);
            }

            // --- Test reset after a pause ---
            game.advanceTime!(300);

            fire(game, player, WeaponId.Chaingun);
            totalTraceCalls += 1; // Should reset to 1 shot
            ammoConsumed += 1;
            expect(trace).toHaveBeenCalledTimes(totalTraceCalls);
            expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(200 - ammoConsumed);
        });
    });
});

import { chaingunThink } from '../../src/combat/weapons/chaingun.js';
import { getWeaponState } from '../../src/combat/weapons/state.js';
import { EntitySystem } from '../../src/entities/system.js';

describe('Chaingun Spin-down', () => {
    let game: GameExports;
    let player: Entity;

    beforeEach(() => {
        const sound = vi.fn();
        const engine = {
            sound,
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };

        game = createGame({ trace: vi.fn(), multicast: vi.fn(), pointcontents: vi.fn(), unicast: vi.fn(), linkentity: vi.fn() }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.sound = sound;

        game.spawnWorld();

        player = game.entities.spawn();
        player.classname = 'player';
        player.client = {
            inventory: createPlayerInventory({
                weapons: [WeaponId.Chaingun],
                ammo: { [AmmoType.Bullets]: 50 },
            }),
            weaponStates: { states: new Map() },
            buttons: 0,
        } as any;
        game.entities.finalizeSpawn(player);
    });

    it('should play spin-down sound when fire button is released', () => {
        // Arrange
        const weaponState = getWeaponState(player.client.weaponStates, WeaponId.Chaingun);
        weaponState.spinupCount = 1;

        // Act
        chaingunThink(player, game as unknown as EntitySystem);

        // Assert
        expect(game.sound).toHaveBeenCalledWith(player, 0, 'weapons/chngnd1a.wav', 1, 0, 0);
        expect(weaponState.spinupCount).toBe(0);
    });
});
