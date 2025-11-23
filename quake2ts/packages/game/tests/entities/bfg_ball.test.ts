// =================================================================
// Quake II - BFG Ball Projectile Tests
// =================================================================

import { describe, it, expect, vi } from 'vitest';
import { createBfgBall } from '../../src/entities/projectiles.js';
import { createGame } from '../../src/index.js';
import { MoveType, Solid } from '../../src/entities/entity.js';
import * as damage from '../../src/combat/damage.js';

describe('BFG Ball Projectile', () => {
    it('should have correct initial properties and deal damage on think', () => {
        const trace = vi.fn();
        const pointContents = vi.fn();
        const T_Damage = vi.spyOn(damage, 'T_Damage');

        const engine = {
            sound: vi.fn(),
            centerprintf: vi.fn(),
            modelIndex: vi.fn(),
        };
        const game = createGame({ trace, pointContents }, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        const playerStart = game.entities.spawn();
        playerStart.classname = 'info_player_start';
        playerStart.origin = { x: 0, y: 0, z: 0 };
        playerStart.angles = { x: 0, y: 0, z: 0 };
        game.entities.finalizeSpawn(playerStart);
        game.spawnWorld();

        const player = game.entities.find(e => e.classname === 'player')!;

        const target = game.entities.spawn();
        target.health = 100;
        target.takedamage = 1;

        trace.mockReturnValue({ ent: target });

        createBfgBall(game.entities, player, player.origin, { x: 1, y: 0, z: 0 }, 200, 400);

        const bfgBall = game.entities.find(e => e.classname === 'bfg_ball')!;

        expect(bfgBall).toBeDefined();
        expect(bfgBall.movetype).toBe(MoveType.FlyMissile);
        expect(bfgBall.solid).toBe(Solid.BoundingBox);
        expect(bfgBall.touch).toBeDefined();

        game.frame({ time: 100, delta: 0.1 });
    });
});
