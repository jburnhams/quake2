// =================================================================
// Quake II - Prox Mine Tests
// =================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createProxMine } from '../../../src/entities/projectiles/prox.js';
import { createGame } from '../../../src/index.js';
import { MoveType, Solid, Entity } from '../../../src/entities/entity.js';
import * as damage from '../../../src/combat/damage.js';
import { Vec3 } from '@quake2ts/shared';

describe('Prox Mine', () => {
    let trace: any;

    // Reset mocks between tests
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createTestGame = () => {
        trace = vi.fn().mockReturnValue({
            fraction: 1.0,
            ent: null
        });
        const pointcontents = vi.fn().mockReturnValue(0);
        const multicast = vi.fn();
        const unicast = vi.fn();
        const sound = vi.fn();
        const modelIndex = vi.fn().mockReturnValue(1);

        const engine = {
            trace,
            sound,
            centerprintf: vi.fn(),
            modelIndex,
        };

        const game = createGame({
            trace,
            pointcontents,
            linkentity: (ent) => {
                // Mock linkentity to set absmin/absmax for findInBox
                ent.absmin = {
                    x: ent.origin.x + (ent.mins?.x || -16),
                    y: ent.origin.y + (ent.mins?.y || -16),
                    z: ent.origin.z + (ent.mins?.z || -24),
                };
                ent.absmax = {
                    x: ent.origin.x + (ent.maxs?.x || 16),
                    y: ent.origin.y + (ent.maxs?.y || 16),
                    z: ent.origin.z + (ent.maxs?.z || 32),
                };
            },
            multicast,
            unicast,
            areaEdicts: vi.fn().mockReturnValue(null) // Use fallback iteration
        }, engine, { gravity: { x: 0, y: 0, z: 0 }, deathmatch: true }); // Disable gravity, enable deathmatch to skip auto-spawn player

        game.init(0);

        // Setup world
        game.spawnWorld();

        // Setup player
        const player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.angles = { x: 0, y: 0, z: 0 };
        player.solid = Solid.BoundingBox;
        game.entities.finalizeSpawn(player);
        game.entities.linkentity(player);

        return { game, player, trace };
    };

    it('should limit mines to 50 per player', () => {
        const { game, player } = createTestGame();

        // Spawn 50 mines
        const mines: Entity[] = [];
        for (let i = 0; i < 50; i++) {
            // Manually increment time to ensure distinct timestamps
            const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);
            mine.timestamp = i;
            mines.push(mine);
        }

        // Verify all 50 exist
        expect(game.entities.findByClassname('prox_mine').length).toBe(50);
        expect(mines[0].inUse).toBe(true);

        // Spawn 51st mine
        const newMine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);
        newMine.timestamp = 50;

        // Verify only 50 exist (one removed)
        expect(mines[0].inUse).toBe(false);
        expect(mines[1].inUse).toBe(true);
        expect(game.entities.findByClassname('prox_mine').length).toBe(50);
    });

    it('should not trigger on owner', () => {
        const { game, player } = createTestGame();
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        // Simulate mine landing and arming
        mine.touch!(mine, null, undefined, undefined); // Land

        // Advance time to arm (1000ms delay)
        game.frame({ time: 1500, delta: 1.5 });

        // Move player near mine
        player.origin = { ...mine.origin };
        game.entities.linkentity(player);

        // Run frame
        game.frame({ time: 1600, delta: 0.1 });

        // Should not have exploded
        expect(T_RadiusDamage).not.toHaveBeenCalled();
        expect(mine.inUse).toBe(true);
    });

    it('should trigger on enemy', () => {
        const { game, player } = createTestGame();
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        // Simulate landing
        mine.touch!(mine, null, undefined, undefined);

        // Advance time to arm
        game.frame({ time: 1500, delta: 1.5 });

        // Create enemy
        const enemy = game.entities.spawn();
        enemy.classname = 'monster_soldier';
        enemy.takedamage = true;
        enemy.health = 100;
        enemy.solid = Solid.BoundingBox; // IMPORTANT: Must be solid for findInBox
        enemy.origin = { ...mine.origin };
        enemy.mins = { x: -16, y: -16, z: -24 };
        enemy.maxs = { x: 16, y: 16, z: 32 };
        game.entities.finalizeSpawn(enemy);
        game.entities.linkentity(enemy);

        // Run frame
        game.frame({ time: 1600, delta: 0.1 });

        // Should have exploded
        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(mine.inUse).toBe(false);
    });

    it.skip('should trigger via laser tripwire (trace check)', () => {
        const { game, player, trace } = createTestGame();
        const T_RadiusDamage = vi.spyOn(damage, 'T_RadiusDamage');

        const mine = createProxMine(game.entities, player, player.origin, { x: 0, y: 0, z: 1 }, 600);

        // Land on a surface (floor)
        const plane = { normal: { x: 0, y: 0, z: 1 } };
        mine.touch!(mine, null, plane as any, undefined);

        // Advance time to arm
        game.frame({ time: 1500, delta: 1.5 });

        // Create enemy far away (out of radius) but in beam path
        const enemy = game.entities.spawn();
        enemy.classname = 'monster_soldier';
        enemy.takedamage = true;
        enemy.health = 100;
        enemy.solid = Solid.BoundingBox; // IMPORTANT
        enemy.origin = { x: 0, y: 0, z: 150 };
        enemy.mins = { x: -16, y: -16, z: -24 };
        enemy.maxs = { x: 16, y: 16, z: 32 };
        game.entities.finalizeSpawn(enemy);
        game.entities.linkentity(enemy);

        // Mock trace to hit enemy
        trace.mockReturnValue({
            fraction: 0.5,
            ent: enemy,
            endpos: { x: 0, y: 0, z: 150 }
        });

        // Run frame
        game.frame({ time: 1600, delta: 0.1 });

        // Should have exploded due to beam
        expect(T_RadiusDamage).toHaveBeenCalled();
        expect(mine.inUse).toBe(false);
    });
});
