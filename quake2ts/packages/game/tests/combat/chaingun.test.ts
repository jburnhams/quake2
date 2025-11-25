// =================================================================
// Quake II - Chaingun Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as damage from '../../src/combat/damage.js';

describe('Chaingun', () => {
    it('should consume 1 bullet and deal damage', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;
        player.client!.inventory = createPlayerInventory({
            weapons: [WeaponId.Chaingun],
            ammo: { [AmmoType.Bullets]: 50 },
        });

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({
            ent: target,
            endpos: { x: 10, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });

        fire(game, player, WeaponId.Chaingun);

        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(49);
        expect(trace).toHaveBeenCalledTimes(1);
        expect(T_Damage).toHaveBeenCalled();
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
