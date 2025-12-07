import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeadFlag, Entity, MoveType, Solid } from '../../src/entities/entity.js';
import { EntitySystem } from '../../src/entities/system.js';
import { registerMonsterSpawns } from '../../src/entities/monsters/soldier.js';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { ai_stand, ai_walk, ai_run, ai_move } from '../../src/ai/movement.js';
import { throwGibs } from '../../src/entities/gibs.js';
import { createTestContext } from '../test-helpers.js';

// Mock ai functions
vi.mock('../../src/ai/movement.js', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../../src/ai/movement.js')>();
    return {
        ...mod,
        ai_stand: vi.fn(),
        ai_walk: vi.fn(),
        ai_run: vi.fn(),
        ai_move: vi.fn(),
    };
});

// Mock throwGibs
vi.mock('../../src/entities/gibs.js', () => ({
    throwGibs: vi.fn(),
}));

describe('monster_soldier', () => {
    let registry: SpawnRegistry;
    let context: EntitySystem;
    let entity: Entity;
    let spawnFunc: any;

    beforeEach(() => {
        vi.clearAllMocks();
        const spawnMap = new Map();
        registry = {
            register: (name, func) => spawnMap.set(name, func),
            get: (name) => spawnMap.get(name)
        } as unknown as SpawnRegistry;

        registerMonsterSpawns(registry);
        spawnFunc = spawnMap.get('monster_soldier');

        // Use createTestContext
        const testContext = createTestContext();
        context = testContext.entities as unknown as EntitySystem;

        entity = new Entity(0);
        entity.timestamp = 0;
        entity.monsterinfo = {
            aiflags: 0,
            last_sighting: { x: 0, y: 0, z: 0 },
            trail_time: 0,
            pausetime: 0,
        };
    });

    it('should set stand action that calls ai_stand', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });

        // Initial state is standing
        const move = entity.monsterinfo.current_move;
        expect(move).toBeDefined();

        // Use soldier_stand explicitly to ensure we are in stand mode
        entity.monsterinfo.stand!(entity, context);
        const standMove = entity.monsterinfo.current_move;

        const frame = standMove!.frames[0];
        expect(frame.ai).toBeDefined();

        // execute the frame action
        frame.ai!(entity, frame.dist, context);

        expect(ai_stand).toHaveBeenCalled();
    });

    it('should set walk action that calls ai_walk', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });

        // Switch to walk
        entity.monsterinfo.walk!(entity, context);
        const walkMove = entity.monsterinfo.current_move;

        const frame = walkMove!.frames[0];
        expect(frame.ai).toBeDefined();

        // execute the frame action
        frame.ai!(entity, frame.dist, context);

        expect(ai_walk).toHaveBeenCalled();
    });

    it('should set run action that calls ai_run', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });

        entity.enemy = {
          health: 100,
          origin: { x: 100, y: 0, z: 0 },
          absmin: { x: 90, y: -10, z: -10 },
          absmax: { x: 110, y: 10, z: 10 }
        } as Entity; // Needs an enemy to run

        // Switch to run
        entity.monsterinfo.run!(entity, context);
        const runMove = entity.monsterinfo.current_move;

        const frame = runMove!.frames[0];
        expect(frame.ai).toBeDefined();

        // execute the frame action
        frame.ai!(entity, frame.dist, context);

        expect(ai_run).toHaveBeenCalled();
    });

    it('should transition to pain state when pain callback is called with low health', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });
        entity.health = 5; // Less than max_health / 2 (20 / 2 = 10)

        // Mock RNG for pain sound check (frandom < 0.5)
        vi.spyOn(context.rng, 'frandom').mockReturnValue(0.1);

        const initialMove = entity.monsterinfo.current_move;
        entity.pain!(entity, null, 0, 5);

        // Should have transitioned to pain frames
        expect(entity.monsterinfo.current_move).not.toBe(initialMove);
        // Verify it is the pain move (we can check firstframe)
        expect(entity.monsterinfo.current_move?.firstframe).toBe(100);
    });

    it('should throw gibs and remove entity when health is below -40', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });
        entity.health = -50;

        entity.die!(entity, null, null, 100, { x: 0, y: 0, z: 0 }, 0);

        expect(throwGibs).toHaveBeenCalledWith(context, entity.origin, 100);
        expect(context.free).toHaveBeenCalledWith(entity);
        expect(entity.deadflag).toBe(DeadFlag.Dead);
        expect(entity.solid).toBe(Solid.Not);
    });

    it('should transition to death animation when dying but not gibbed', () => {
        spawnFunc(entity, { entities: context, health_multiplier: 1.0 });
        entity.health = -10;

        const initialMove = entity.monsterinfo.current_move;
        entity.die!(entity, null, null, 20, { x: 0, y: 0, z: 0 }, 0);

        expect(entity.deadflag).toBe(DeadFlag.Dead);
        expect(entity.solid).toBe(Solid.Not);
        // Should transition to death frames
        expect(entity.monsterinfo.current_move).not.toBe(initialMove);
        expect(entity.monsterinfo.current_move?.firstframe).toBe(106);

        // Should NOT throw gibs
        expect(throwGibs).not.toHaveBeenCalled();
    });
});
