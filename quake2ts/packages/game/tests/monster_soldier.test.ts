import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import { EntitySystem } from '../src/entities/system.js';
import { registerMonsterSpawns } from '../src/entities/monsters/soldier.js';
import { SpawnRegistry } from '../src/entities/spawn.js';
import { ai_stand, ai_walk, ai_run } from '../src/ai/movement.js';

// Mock ai_stand since we want to check if it's called
vi.mock('../src/ai/movement.js', async (importOriginal) => {
    const mod = await importOriginal<typeof import('../src/ai/movement.js')>();
    return {
        ...mod,
        ai_stand: vi.fn(),
        ai_walk: vi.fn(),
        ai_run: vi.fn(),
    };
});

describe('monster_soldier', () => {
    let registry: SpawnRegistry;
    let context: EntitySystem;
    let entity: Entity;
    let spawnFunc: any;

    beforeEach(() => {
        const spawnMap = new Map();
        registry = {
            register: (name, func) => spawnMap.set(name, func),
            get: (name) => spawnMap.get(name)
        } as unknown as SpawnRegistry;

        registerMonsterSpawns(registry);
        spawnFunc = spawnMap.get('monster_soldier');

        context = {
            timeSeconds: 0
        } as unknown as EntitySystem;

        entity = new Entity(0);
        entity.timestamp = 0;
    });

    it('should set stand action that calls ai_stand', () => {
        spawnFunc(entity, {});

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
        spawnFunc(entity, {});

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
        spawnFunc(entity, {});

        entity.enemy = { health: 100 } as Entity; // Needs an enemy to run

        // Switch to run
        entity.monsterinfo.run!(entity, context);
        const runMove = entity.monsterinfo.current_move;

        const frame = runMove!.frames[0];
        expect(frame.ai).toBeDefined();

        // execute the frame action
        frame.ai!(entity, frame.dist, context);

        expect(ai_run).toHaveBeenCalled();
    });
});
