// =================================================================
// Quake II - BFG10K Weapon Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { fire } from '../../src/combat/weapons/firing.js';
import { createPlayerInventory, WeaponId, AmmoType } from '../../src/inventory/index.js';
import * as projectiles from '../../src/entities/projectiles.js';
import * as damage from '../../src/combat/damage.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { createTestContext, createPlayerEntityFactory, createMonsterEntityFactory, createEntityFactory, spawnEntity, createGameImportsAndEngine } from '@quake2ts/test-utils';
import { ServerFlags } from '../../src/entities/entity.js';
import { createGame } from '../../src/index.js';

describe('BFG10K', () => {
    it('should consume 50 cells and spawn a projectile', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');

        const { entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        spawnEntity(entities, createEntityFactory({
             classname: 'info_player_start',
             origin: { x: 0, y: 0, z: 0 },
             angles: { x: 0, y: 0, z: 0 }
        }));

        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        if (!player.client) player.client = {} as any;
        Object.assign(player.client!, {
            inventory: createPlayerInventory({
                weapons: [WeaponId.BFG10K],
                ammo: { [AmmoType.Cells]: 100 },
            }),
            weaponStates: { states: new Map() }
        });

        fire(game, player, WeaponId.BFG10K);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
        expect(createBfgBall).toHaveBeenCalled();
    });

    it('should deal secondary laser damage on impact', () => {
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const { imports, entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });

        const player = spawnEntity(entities, createPlayerEntityFactory({
             origin: { x: 0, y: 0, z: 0 },
        }));
        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({});

        const target = spawnEntity(entities, createMonsterEntityFactory('monster_target', {
            origin: { x: 200, y: 0, z: 0 },
            takedamage: true,
            health: 100
        }));

        projectiles.createBfgBall(entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);

        const bfgBall = entities.find(e => e.classname === 'bfg blast');
        expect(bfgBall).toBeDefined();

        // Mock trace for visibility check (from player to target)
        imports.trace.mockReturnValue({
             ent: target,
             fraction: 1.0,
             endpos: target.origin,
             plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
             allsolid: false,
             startsolid: false
        });

        // Trigger touch
        bfgBall!.touch!(bfgBall!, entities.world!, null, null);

        // Expect primary radius damage (200 damage, 100 radius based on new implementation)
        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), bfgBall, player, 200, expect.anything(), 100, expect.anything(), DamageMod.BFG_BLAST, expect.anything(), expect.anything(), expect.any(Function));
    });

    it('should deal 500 damage in single-player', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        const { entities, game } = createTestContext({ gravity: { x: 0, y: 0, z: -800 } });
        // SP is default.

        spawnEntity(entities, createEntityFactory({ classname: 'info_player_start' }));
        game.spawnWorld();

        const player = entities.find(e => e.classname === 'player')!;
        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 50 } });

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(entities, player, expect.anything(), expect.anything(), 500, 400, 200);
    });

    it('should deal 200 damage in deathmatch', () => {
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');
        // Manually create with DM flag to ensure both game and sys have it correct from start
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });

        const player = spawnEntity(game.entities, createEntityFactory({
             classname: 'player'
        }));

        player.client = {
            inventory: createPlayerInventory({ weapons: [WeaponId.BFG10K], ammo: { [AmmoType.Cells]: 50 } }),
            weaponStates: { states: new Map() }
        } as any;

        fire(game, player, WeaponId.BFG10K);

        expect(createBfgBall).toHaveBeenCalledWith(game.entities, player, expect.anything(), expect.anything(), 200, 400, 200);
    });

    it('should fire in-flight lasers at nearby enemies every 100ms', () => {
        const T_DamageSpy = vi.spyOn(damage, 'T_Damage');

        // Use manual creation to ensure EntitySystem has deathmatch=true
        const { imports, engine } = createGameImportsAndEngine();
        const game = createGame(imports, engine as any, { gravity: { x: 0, y: 0, z: -800 }, deathmatch: true });
        const entities = game.entities;

        const player = spawnEntity(entities, createPlayerEntityFactory({
            origin: { x: 0, y: 0, z: 0 }
        }));

        if (!player.client) player.client = {} as any;
        player.client!.inventory = createPlayerInventory({});

        // Create a target within 256 units
        const target = spawnEntity(entities, createMonsterEntityFactory('monster_gladiator', {
            origin: { x: 100, y: 0, z: 0 },
            svflags: ServerFlags.Monster,
            absmin: { x: 90, y: -10, z: -10 },
            absmax: { x: 110, y: 10, z: 10 }
        }));

        projectiles.createBfgBall(entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);
        const bfgBall = entities.find(e => e.classname === 'bfg blast')!;
        expect(bfgBall).toBeDefined();

        // Initial think scheduled?
        expect(bfgBall.think).toBeDefined();

        // Spy on findByRadius to return our target
        const findByRadiusSpy = vi.spyOn(entities, 'findByRadius');
        findByRadiusSpy.mockReturnValue([target]);

        imports.trace
            .mockReturnValueOnce({ fraction: 1.0, ent: null, allsolid: false, startsolid: false, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } }) // LOS Check: Clear
            .mockReturnValueOnce({ fraction: 0.1, ent: target, endpos: target.origin, allsolid: false, startsolid: false, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } }) // Laser Trace: Hit Target
            .mockReturnValueOnce({ fraction: 1.0, ent: null, allsolid: false, startsolid: false, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } }) // Laser Trace Next: Miss (stop piercing)
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 200, y: 0, z: 0 }, ent: null, allsolid: false, startsolid: false, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } }); // Effect Trace

        // Execute think
        const thinkFn = bfgBall.think!;
        thinkFn(bfgBall, entities);

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
        expect(bfgBall.nextthink).toBeCloseTo(entities.timeSeconds + 0.1);
    });
});
