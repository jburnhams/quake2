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

describe('BFG10K', () => {
    it('should consume 50 cells and spawn a projectile', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const createBfgBall = vi.spyOn(projectiles, 'createBfgBall');

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
            weapons: [WeaponId.BFG10K],
            ammo: { [AmmoType.Cells]: 100 },
        });

        fire(game, player, WeaponId.BFG10K);

        expect(player.client!.inventory.ammo.counts[AmmoType.Cells]).toBe(50);
        expect(createBfgBall).toHaveBeenCalled();
    });

    it('should deal secondary laser damage on impact', () => {
        const trace = vi.fn();
        const pointcontents = vi.fn();
        const multicast = vi.fn();
        const unicast = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const engine = {
            trace: vi.fn(),
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointcontents, linkentity: vi.fn(), multicast, unicast }, engine, { gravity: { x: 0, y: 0, z: -800 } });

        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.client = { inventory: { ammo: { counts: [] } } } as any;
        game.entities.finalizeSpawn(player);

        const target = game.entities.spawn();
        target.classname = 'monster_target';
        target.origin = { x: 200, y: 0, z: 0 };
        target.takedamage = 1;
        target.health = 100;
        game.entities.finalizeSpawn(target);

        // Manually create BFG ball to test its touch function
        projectiles.createBfgBall(game.entities, player, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 200, 400, 200);
        const bfgBall = game.entities.find(e => e.classname === 'bfg_ball')!;

        // Mock trace for visibility check (from player to target)
        trace.mockReturnValue({
             ent: target,
             fraction: 1.0,
             endpos: target.origin,
        });

        // Trigger touch
        bfgBall.touch!(bfgBall, game.entities.world!, null, null);

        // Expect primary radius damage
        expect(T_RadiusDamage).toHaveBeenCalledWith(expect.anything(), bfgBall, player, 200, player, 200, expect.anything(), DamageMod.BFG_BLAST, expect.anything(), expect.any(Function));

        // Expect secondary laser damage
        // Target is within 1000 units (200 units away) and visible
        expect(T_Damage).toHaveBeenCalledWith(
            target,
            bfgBall,
            player,
            expect.anything(), // dir
            target.origin,
            ZERO_VEC3,
            10, // Laser damage
            10, // Kick
            expect.anything(), // Flags
            DamageMod.BFG_LASER,
            expect.any(Function)
        );
    });
});
