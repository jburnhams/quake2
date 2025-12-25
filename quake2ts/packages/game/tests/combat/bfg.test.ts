// =================================================================
// Quake II - BFG10K Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createGame } from '../../src/index.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import * as damage from '../../src/combat/damage.js';
import { ZERO_VEC3 } from '@quake2ts/shared';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createGameImportsAndEngine, createPlayerEntityFactory, createMonsterEntityFactory, createEntityFactory } from '@quake2ts/test-utils';
import { ServerFlags, MoveType, Solid, DeadFlag } from '../../src/entities/entity.js';

describe('BFG10K', () => {
    it('should consume 50 cells and spawn a projectile', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const playerStart = createEntityFactory({
             classname: 'info_player_start',
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 }
        });
        game.entities.spawn = vi.fn().mockReturnValue(playerStart);
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({
                    weapons: [WeaponId.BFG10K],
                    ammo: { [AmmoType.Cells]: 100 },
                }),
                weaponStates: { states: new Map() }
            } as any
        });
        // We need to inject player into game.entities
        game.entities.find = vi.fn().mockReturnValue(player);

        fire(game, player, WeaponId.BFG10K);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
        expect(createBfgBall).toHaveBeenCalled();
    });

    it('should deal secondary laser damage on impact', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const player = createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
             client: { inventory: { ammo: { counts: [] } } } as any
        });

        const target = createMonsterEntityFactory('monster_target', {
            origin: { x: 200, y: 0, z: 0 },
            takedamage: true,
            health: 100
        });

        // Manually create BFG ball to test its touch function
        // We need to make sure entities.spawn works if createBfgBall uses it
        // but here we are calling createBfgBall directly which uses game.entities
        // Let's mock game.entities.spawn to return a new entity
        const bfgBall = createEntityFactory({ classname: 'bfg blast' });
        game.entities.spawn = vi.fn().mockReturnValue(bfgBall);

        projectiles.createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);

        // Mock trace for visibility check (from player to target)
        imports.trace.mockReturnValue({
             ent: target,
             fraction: 1.0,
             endpos: target.origin,
        });

        // Trigger touch
        bfgBall.touch!(bfgBall, game.entities.world!, null, null);

        // Expect primary radius damage (200 damage, 100 radius based on new implementation)
        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), bfgBall, player, 200, expect.anything(), 100, expect.anything(), DamageMod.BFG_BLAST, game.time, expect.anything(), expect.any(Function));
    });

    it('should deal 500 damage in single-player', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.deathmatch = false;

        const player = createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 100 } }),
                weaponStates: { states: new Map() }
            } as any
        });

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 500, 400, 200);
    });

    it('should deal 200 damage in deathmatch', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.deathmatch = true;

        const player = createPlayerEntityFactory({
            client: {
                inventory: createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 100 } }),
                weaponStates: { states: new Map() }
            } as any
        });

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything(), 200, 400, 200);
    });

    it('should fire in-flight lasers at nearby enemies every 100ms', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        // Spy on T_Damage to verify lasers hitting
        const T_DamageSpy = vi.spyOn(damage, 'T_Damage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame(
            { trace, pointcontents, linkentity: vi.fn(), multicast, unicast },
            engine,
            { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true }
        );

        const player = createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 }
        });
        game.entities.spawn = vi.fn().mockReturnValue(player);
        game.entities.finalizeSpawn(player);

        // Create a target within 256 units
        const target = createMonsterEntityFactory('monster_gladiator', {
            origin: { x: 100, y: 0, z: 0 },
            svflags: ServerFlags.Monster,
            absmin: { x: 90, y: -10, z: -10 },
            absmax: { x: 110, y: 10, z: 10 }
        });

        // Create BFG ball
        const bfgBall = createEntityFactory({ classname: 'bfg blast' });
        game.entities.spawn = vi.fn().mockReturnValue(bfgBall);

        projectiles.createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);

        // Initial think scheduled?
        expect(bfgBall.think).toBeDefined();

        // Spy on findByRadius to return our target
        const findByRadiusSpy = vi.spyOn(game.entities, 'findByRadius');
        findByRadiusSpy.mockReturnValue([target]);

        trace
            .mockReturnValueOnce({ fraction: 1.0 }) // LOS Check: Clear
            .mockReturnValueOnce({ fraction: 0.1, ent: target, endpos: target.origin }) // Laser Trace: Hit Target
            .mockReturnValueOnce({ fraction: 1.0 }) // Laser Trace Next: Miss (stop piercing)
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 200, y: 0, z: 0 } }); // Effect Trace

        // Execute think
        const thinkFn = bfgBall.think!;
        thinkFn(bfgBall, game.entities);

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
        expect(bfgBall.nextthink).toBeCloseTo(game.entities.timeSeconds + 0.1);
    });
});
