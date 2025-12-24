// =================================================================
// Quake II - Chaingun Weapon Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import { createGameImportsAndEngine, createEntityFactory, createPlayerEntityFactory, createMonsterEntityFactory } from '@quake2ts/test-utils';
import { Entity } from '../../src/entities/entity.js';

describe('Chaingun', () => {
    let game: any;
    let player: Entity;
    let target: Entity;
    let imports: any;

    beforeEach(() => {
        const setup = createGameImportsAndEngine();
        imports = setup.imports;
        const engine = setup.engine;
        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const weaponStates = new Map();
        weaponStates.set(WeaponId.Chaingun, { frame: 0, lastFireTime: 0 });

        player = game.entities.spawn();
        Object.assign(player, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.Chaingun],
                    ammo: { [AmmoType.Bullets]: 200 },
                }),
                weaponStates: { states: weaponStates, lastFireTime: 0, activeWeaponId: WeaponId.Chaingun }
            } as any
        }));
        game.entities.find = vi.fn().mockReturnValue(player);

        target = game.entities.spawn();
        Object.assign(target, createMonsterEntityFactory('monster_dummy', {
            health: 100
        }));

        imports.trace.mockReturnValue({
            ent: target,
            endpos: { x: 100, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } },
        });
    });

    it('should fire 1 shot on first spinup (count 1-5)', () => {
        fire(game, player, WeaponId.Chaingun);
        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(199);
    });

    it('should fire 2 shots on medium spinup (count 6-10)', () => {
        const state = player.client!.weaponStates.states.get(WeaponId.Chaingun)!;
        state.spinupCount = 5;

        fire(game, player, WeaponId.Chaingun);
        expect(state.spinupCount).toBe(6);
        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(198);
    });

    it('should fire 3 shots on full spinup (count > 10)', () => {
        const state = player.client!.weaponStates.states.get(WeaponId.Chaingun)!;
        state.spinupCount = 10;

        fire(game, player, WeaponId.Chaingun);
        expect(state.spinupCount).toBe(11);
        expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(197);
    });

    it('should reset spinup if fire paused', () => {
         const state = player.client!.weaponStates.states.get(WeaponId.Chaingun)!;
         state.spinupCount = 10;
         state.lastFireTime = 0;
         // Mock game.time via getter
         vi.spyOn(game, 'time', 'get').mockReturnValue(500);

         fire(game, player, WeaponId.Chaingun);

         expect(state.spinupCount).toBe(1); // Resets to 1, then increments to 1
         expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(199);
    });

    it('should handle low ammo gracefully', () => {
        // Reuse the main game/imports for loop test to fix undefined issues
        // We can just iterate test cases using the beforeEach setup, but setting up fresh player/target
        // is tricky with beforeEach unless we reset every time.
        // Actually, let's just make a helper function using our reliable createGameImportsAndEngine

        const testCases = [
            { spinup: 10, ammo: 2, expected: 2 }, // Wants 3, has 2
            { spinup: 5, ammo: 1, expected: 1 },  // Wants 2, has 1
        ];

        testCases.forEach(({ spinup, ammo, expected }) => {
            // New context for each iteration to avoid pollution
            const { imports, engine } = createGameImportsAndEngine();
            const localGame = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

            const weaponStates = new Map();
            weaponStates.set(WeaponId.Chaingun, { frame: 0, lastFireTime: 0 });

            const player = localGame.entities.spawn();
            Object.assign(player, createPlayerEntityFactory({
                client: {
                    inventory: createPlayerInventory({ weapons: [WeaponId.Chaingun], ammo: { [AmmoType.Bullets]: ammo } }),
                    weaponStates: { states: weaponStates }
                } as any
            }));
            const state = player.client!.weaponStates.states.get(WeaponId.Chaingun)!;
            state.spinupCount = spinup;
            // Ensure lastFireTime is recent so it doesn't reset spinup
            state.lastFireTime = localGame.time; // Use localGame.time which defaults to 0 usually

            const target = localGame.entities.spawn();
            Object.assign(target, createMonsterEntityFactory('monster_dummy', {
                takedamage: true
            }));

            // Critical fix: mock trace must return endpos for fireHitscan distance calculation
            imports.trace.mockReturnValue({
                ent: target,
                endpos: { x: 100, y: 0, z: 0 },
                plane: { normal: { x: -1, y: 0, z: 0 } }
            });

            fire(localGame, player, WeaponId.Chaingun);
            expect(player.client!.inventory.ammo.counts[AmmoType.Bullets]).toBe(ammo - expected);
        });
    });
});
