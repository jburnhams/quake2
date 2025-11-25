// =================================================================
// Quake II - BFG In-Flight Laser Behavior Tests
// =================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createBfgBall } from '../../src/entities/projectiles.js';
import { createGame, GameExports } from '../../src/index.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import * as damage from '../../src/combat/damage.js';
import { Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { GameImports } from '../../src/imports.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { ZERO_VEC3 } from '@quake2ts/shared';

describe('BFG In-Flight Lasers', () => {
    let game: GameExports;
    let T_Damage: any;
    let trace: any;
    let multicast: any;
    let player: Entity;
    const monsters: Entity[] = [];

    beforeEach(() => {
        T_Damage = vi.spyOn(damage, 'T_Damage');
        trace = vi.fn();
        multicast = vi.fn();

        const imports: GameImports = {
            trace,
            pointcontents: vi.fn(),
            linkentity: (ent: Entity) => {
                // Mock linkentity to prevent crashes in the test environment
                if (ent.origin && ent.mins && ent.maxs) {
                    ent.absmin = { x: ent.origin.x + ent.mins.x, y: ent.origin.y + ent.mins.y, z: ent.origin.z + ent.mins.z };
                    ent.absmax = { x: ent.origin.x + ent.maxs.x, y: ent.origin.y + ent.maxs.y, z: ent.origin.z + ent.maxs.z };
                }
            },
            multicast,
            unicast: vi.fn(),
        };

        const engine = {
            trace: vi.fn(), sound: vi.fn(), centerprintf: vi.fn(), modelIndex: vi.fn(),
        };

        game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });
        game.init(0);

        // Spawn a simplified player
        player = game.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };
        player.movetype = MoveType.Step;
        player.solid = Solid.BoundingBox;
        game.entities.finalizeSpawn(player);

        // Spawn monsters
        monsters.length = 0;
        for (let i = 0; i < 3; i++) {
            const monster = game.entities.spawn();
            monster.classname = 'monster_test';
            monster.health = 100;
            monster.takedamage = 1;
            monster.solid = Solid.BoundingBox;
            monster.movetype = MoveType.Step;
            monster.origin = { x: 100 + i * 50, y: 0, z: 0 };
            monster.mins = { x: -16, y: -16, z: -16 };
            monster.maxs = { x: 16, y: 16, z: 16 };
            game.entities.finalizeSpawn(monster);
            monsters.push(monster);
        }

        // Refined trace mock
        trace.mockImplementation((start, end, from, to) => {
            if (to) {
                const targetMonster = monsters.find(m => m.origin.x === to.x && m.origin.y === to.y && m.origin.z === to.z);
                if (targetMonster) {
                    return { ent: targetMonster, fraction: 1.0, allsolid: false, startsolid: false, endpos: to };
                }
            }
            // Default non-colliding trace
            return { fraction: 1.0, endpos: end || start };
        });

        // Mock findByRadius to return only monsters
        vi.spyOn(game.entities, 'findByRadius').mockImplementation((origin, radius) => {
            return monsters.filter(m => {
                const dist = Math.sqrt(Math.pow(m.origin.x - origin.x, 2) + Math.pow(m.origin.y - origin.y, 2) + Math.pow(m.origin.z - origin.z, 2));
                return dist <= radius;
            });
        });
    });

    it('should damage nearby monsters with lasers every 100ms while in flight', () => {
        const startPos = { x: player.origin.x + 40, y: player.origin.y, z: player.origin.z };
        const bfgBall = createBfgBall(game.entities, player, startPos, { x: 1, y: 0, z: 0 }, 200, 400, 1000);

        // Store the initial origins before the frame, as they might be mutated by physics.
        const initialMonsterOrigins = monsters.map(m => ({ ...m.origin }));

        // The BFG ball is spawned at time 0, its first think is scheduled for time 100.
        // Let's run the first frame.
        game.frame({ time: 100, delta: 0.1 });

        // The first laser attack should happen now.
        expect(T_Damage).toHaveBeenCalledTimes(monsters.length);

        // Inspect the arguments of each call to T_Damage.
        for (let i = 0; i < T_Damage.mock.calls.length; i++) {
            const monster = monsters[i];
            const callArgs = T_Damage.mock.calls[i];

            expect(callArgs[0]).toBe(monster);
            expect(callArgs[1]).toBe(bfgBall);
            expect(callArgs[2]).toBe(player);
            expect(callArgs[3]).toEqual(expect.any(Object)); // dir
            expect(callArgs[4]).toEqual(initialMonsterOrigins[i]); // point
            expect(callArgs[5]).toEqual(ZERO_VEC3); // normal
            expect(callArgs[6]).toBe(10); // damage
            expect(callArgs[7]).toBe(1); // knockback
            expect(callArgs[8]).toBe(DamageFlags.ENERGY);
            expect(callArgs[9]).toBe(DamageMod.BFG_LASER);
            expect(typeof callArgs[10]).toBe('function'); // multicast
        }

        // Clear the mock for the next frame check.
        T_Damage.mockClear();

        // Run the second frame. The next think is scheduled for time 200.
        game.frame({ time: 200, delta: 0.1 });
        expect(T_Damage).toHaveBeenCalledTimes(monsters.length);
    });
});
