import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestGame, spawnEntity, createEntityFactory } from '@quake2ts/test-utils';
import type { GameExports } from '../../../src/index.js';
import type { SpawnContext } from '../../../src/entities/spawn.js';

describe('func_rotating', () => {
    let game: GameExports;
    let spawnContext: SpawnContext;

    beforeEach(() => {
        const result = createTestGame();
        game = result.game;

        spawnContext = {
            keyValues: {},
            entities: game.entities,
            health_multiplier: 1,
            warn: vi.fn(),
            free: (e) => game.entities.free(e)
        };

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes correctly', () => {
        const ent = spawnEntity(game.entities, createEntityFactory({
            classname: 'func_rotating',
            speed: 100,
            model: '*1'
        }));

        const spawnFn = game.entities.getSpawnFunction('func_rotating');
        expect(spawnFn).toBeDefined();
        spawnFn?.(ent, spawnContext);

        expect(ent.movetype).toBe(MoveType.Push);
        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.avelocity.z).toBe(100);
    });

    it('sets angular velocity based on spawnflags', () => {
        const ent = spawnEntity(game.entities, createEntityFactory({
            classname: 'func_rotating',
            speed: 100,
            spawnflags: 4, // X-Axis
            model: '*1'
        }));

        const spawnFn = game.entities.getSpawnFunction('func_rotating');
        spawnFn?.(ent, spawnContext);

        expect(ent.avelocity.x).toBe(100);
        expect(ent.avelocity.y).toBe(0);
        expect(ent.avelocity.z).toBe(0);
    });

    it('inflicts pain on blocked', () => {
        const ent = spawnEntity(game.entities, createEntityFactory({
            classname: 'func_rotating',
            dmg: 10,
            model: '*1'
        }));

        const spawnFn = game.entities.getSpawnFunction('func_rotating');
        spawnFn?.(ent, spawnContext);

        expect(ent.blocked).toBeDefined();

        const victim = spawnEntity(game.entities, createEntityFactory({
            classname: 'player',
            health: 100,
            takedamage: true
        }));

        if (ent.blocked) {
             ent.blocked(ent, victim);
        }

        // Ensure damage is applied directly to health.
        // func_rotating's blocked handler applies damage directly rather than relying solely on T_Damage.
        expect(victim.health).toBe(90);
    });
});
