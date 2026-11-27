import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestGame, spawnEntity, createEntityFactory } from '@quake2ts/test-utils';
import type { GameExports } from '../../../src/index.js';
import type { SpawnContext } from '../../../src/entities/spawn.js';

// Mock T_Damage
vi.mock('../../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

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

    const spawnRotating = (fields: Record<string, unknown>, keys: Record<string, string> = {}) => {
        spawnContext.keyValues = keys;
        const ent = spawnEntity(game.entities, createEntityFactory({ classname: 'func_rotating', model: '*1', ...fields }));
        game.entities.getSpawnFunction('func_rotating')!(ent, spawnContext);
        return ent;
    };

    it('waits to be used unless START_ON, then turns about yaw by default', () => {
        const ent = spawnRotating({ speed: 100 });
        expect(ent.movetype).toBe(MoveType.Push);
        expect(ent.solid).toBe(Solid.Bsp);
        expect(ent.avelocity).toEqual({ x: 0, y: 0, z: 0 });

        ent.use!(ent, null, null);
        // movedir is an angles vector: Z_AXIS turns yaw (movedir[1])
        expect(ent.avelocity).toEqual({ x: 0, y: 100, z: 0 });
        ent.use!(ent, null, null);
        expect(ent.avelocity).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('turns about roll with X_AXIS and pitch with Y_AXIS, backwards with REVERSE', () => {
        expect(spawnRotating({ speed: 100, spawnflags: 1 | 4 }).avelocity).toEqual({ x: 0, y: 0, z: 100 });
        expect(spawnRotating({ speed: 100, spawnflags: 1 | 8 }).avelocity).toEqual({ x: 100, y: 0, z: 0 });
        expect(spawnRotating({ speed: 50, spawnflags: 1 | 2 }).avelocity).toEqual({ x: -0, y: -50, z: -0 });
    });

    it('hurts what blocks it by dmg, at most ten times a second', async () => {
        const { T_Damage } = await import('../../../src/combat/damage.js');
        const ent = spawnRotating({ dmg: 10, spawnflags: 1 }, { dmg: '10' });
        const victim = spawnEntity(game.entities, createEntityFactory({ classname: 'player', health: 100, takedamage: true }));
        ent.moveinfo!.blocked!(ent, victim);
        ent.moveinfo!.blocked!(ent, victim);
        expect(T_Damage).toHaveBeenCalledTimes(1);
        expect((T_Damage as any).mock.calls[0][6]).toBe(10);
    });

    it('does 2 damage unless dmg is given', () => {
        expect(spawnRotating({}).dmg).toBe(2);
    });
});
