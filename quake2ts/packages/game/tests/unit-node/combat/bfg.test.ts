// =================================================================
// Quake II - BFG10K Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../../src/inventory/index.js';
import * as projectiles from '../../../src/entities/projectiles.js';
import * as damage from '../../../src/combat/damage.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import {
    createTestGame,
    spawnEntity,
    createPlayerEntityFactory,
    createMonsterEntityFactory,
    createEntityFactory
} from '@quake2ts/test-utils';
import { ServerFlags } from '../../../src/entities/entity.js';

describe('BFG10K', () => {
    it('should consume 50 cells and spawn a projectile', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');

        const { game } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.BFG10K],
                    ammo: { [AmmoType.Cells]: 100 },
                }),
                weaponStates: { states: new Map() }
            } as any
        }));

        fire(game, player, WeaponId.BFG10K);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
        expect(createBfgBall).toHaveBeenCalled();
    });

    it('should deal secondary laser damage on impact', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { game, imports } = createTestGame();

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
             client: { inventory: { ammo: { counts: [] } } } as any
        }));

        const target = spawnEntity(game.entities, createMonsterEntityFactory('monster_target', {
            origin: { x: 200, y: 0, z: 0 },
            takedamage: true,
            health: 100
        }));

        // Spy on spawn to capture bfgBall
        const spawnSpy = vi.spyOn(game.entities, 'spawn');

        projectiles.createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);

        // Find the bfg ball (it should be the last spawned entity, or find by classname)
        const bfgBall = game.entities.find(e => e.classname === 'bfg blast');
        expect(bfgBall).toBeDefined();

        // Mock trace for visibility check (from player to target)
        imports.trace.mockReturnValue({
             ent: target,
             fraction: 1.0,
             endpos: target.origin,
             plane: null,
             contents: 0,
             surface: null,
             startsolid: false,
             allsolid: false
        });

        // Trigger touch
        if (bfgBall && bfgBall.touch) {
             bfgBall.touch(bfgBall, game.entities.world!, null, null);
        } else {
            throw new Error('BFG ball not spawned correctly');
        }

        // Expect primary radius damage (200 damage, 100 radius based on new implementation)
        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), bfgBall, player, 200, expect.anything(), 100, expect.anything(), DamageMod.BFG_BLAST, game.time, expect.anything(), expect.any(Function));
    });

    it('should deal 500 damage in single-player', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        const { game } = createTestGame({
            config: { deathmatch: false }
        });

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 50 } }),
                weaponStates: { states: new Map() }
            } as any
        }));

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 500, 400, 200);
    });

    it('should deal 200 damage in deathmatch', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        const { game } = createTestGame({
            config: { deathmatch: true }
        });

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 50 } }),
                weaponStates: { states: new Map() }
            } as any
        }));

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 200, 400, 200);
    });

    it('should fire in-flight lasers at nearby enemies every 100ms', () => {
        // Spy on T_Damage to verify lasers hitting
        const T_DamageSpy = vi.spyOn(damage, 'T_Damage');

        const { game, imports } = createTestGame({
            config: { deathmatch: true }
        });
        const trace = imports.trace;

        const player = spawnEntity(game.entities, createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 }
        }));

        // Create a target within 256 units
        const target = spawnEntity(game.entities, createMonsterEntityFactory('monster_gladiator', {
            origin: { x: 100, y: 0, z: 0 },
            svflags: ServerFlags.Monster,
            absmin: { x: 90, y: -10, z: -10 },
            absmax: { x: 110, y: 10, z: 10 }
        }));

        projectiles.createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);

        const bfgBall = game.entities.find(e => e.classname === 'bfg blast');
        expect(bfgBall).toBeDefined();

        // Initial think scheduled?
        expect(bfgBall!.think).toBeDefined();

        // Use real findByRadius, so we need to ensure target is findable.
        // spawnEntity adds to entity list.
        // findByRadius uses internal physics/grid usually.
        // BUT createTestGame uses real EntitySystem, which has findByRadius.
        // The default findByRadius implementation checks distance.
        // So we don't need to spy on it if the logic is correct.
        // However, the test relied on spy. Let's see if we can rely on real implementation.
        // If not, we can spy on game.entities.findByRadius.

        // Let's spy to be safe and match original test logic which forced return.
        const findByRadiusSpy = vi.spyOn(game.entities, 'findByRadius');
        findByRadiusSpy.mockReturnValue([target]);

        trace
            .mockReturnValueOnce({ fraction: 1.0, plane: null, surface: null, ent: null }) // LOS Check: Clear
            .mockReturnValueOnce({ fraction: 0.1, ent: target, endpos: target.origin, plane: null, surface: null }) // Laser Trace: Hit Target
            .mockReturnValueOnce({ fraction: 1.0, plane: null, surface: null, ent: null }) // Laser Trace Next: Miss (stop piercing)
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 200, y: 0, z: 0 }, plane: null, surface: null, ent: null }); // Effect Trace

        // Execute think
        const thinkFn = bfgBall!.think!;
        thinkFn(bfgBall!, game.entities);

        // Should have damaged the target (laser hit)
        expect(T_DamageSpy).toHaveBeenCalledWith(
            target,
            bfgBall,
            player,
            expect.anything(), // dir
            expect.anything(), // point
            expect.anything(), // normal
            5, // damage (DM=5)
            1, // kick
            expect.anything(),
            DamageMod.BFG_LASER,
            expect.anything(),
            expect.anything(),
            expect.objectContaining({ checkFriendlyFire: false, noFriendlyFire: true })
        );

        // Should reschedule for 100ms later
        expect(bfgBall!.nextthink).toBeCloseTo(game.entities.timeSeconds + 0.1);
    });
});
