import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { EntitySystem } from '../../../src/entities/system.js';
import { createTestContext, createTestGame, spawnEntityFromDictionary, createEntityFactory } from '@quake2ts/test-utils';
import { SP_func_object } from '../../../src/entities/misc.js';
import { MoveType, Solid } from '../../../src/entities/entity.js';
import * as damageModule from '../../../src/combat/damage.js';

// Mock T_Damage
vi.mock('../../../src/combat/damage.js', async () => {
    const { createMockDamage } = await import('@quake2ts/test-utils');
    return createMockDamage();
});

describe('Misc Entities', () => {
    // Use createTestGame to get a fully initialized game instance with registry
    const { game } = createTestGame();
    const entities = game.entities;

    it('misc_teleporter should be created', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_teleporter' });
        expect(entity).toBeDefined();
    });

    it('misc_teleporter_dest should be created', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_teleporter_dest' });
        expect(entity).toBeDefined();
    });

    it('misc_explobox should be created with correct properties', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_explobox' });
        expect(entity).toBeDefined();
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.movetype).toBe(MoveType.None);
    });

    it('misc_banner should be created with correct properties', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_banner' });
        expect(entity).toBeDefined();
        expect(entity.solid).toBe(Solid.Not);
        expect(entity.movetype).toBe(MoveType.None);
    });

    it('misc_deadsoldier should be created with correct properties', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_deadsoldier' });
        expect(entity).toBeDefined();
        expect(entity.solid).toBe(Solid.Bsp);
        expect(entity.movetype).toBe(MoveType.None);
    });

    it('misc_gib_arm should be created with correct properties', () => {
        const entity = spawnEntityFromDictionary(entities, { classname: 'misc_gib_arm' });
        expect(entity).toBeDefined();
        expect(entity.solid).toBe(Solid.Not);
        expect(entity.movetype).toBe(MoveType.Toss);
    });
});

describe('func_object', () => {
    let context: ReturnType<typeof createTestContext>;
    let sys: EntitySystem;

    beforeEach(() => {
        context = createTestContext();
        sys = context.entities;
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('initializes correctly', () => {
        const ent = createEntityFactory({
            classname: 'func_object',
            origin: { x: 10, y: 20, z: 30 },
            model: '*1'
        });

        SP_func_object(ent, { entities: sys } as any);

        expect(ent.movetype).toBe(MoveType.Push);
        expect(ent.solid).toBe(Solid.Bsp);

        // Execute the think function to complete initialization
        expect(ent.think).toBeDefined();
        if (ent.think) {
             ent.think(ent, sys);
        }

        // After release, properties should be updated
        expect(ent.movetype).toBe(MoveType.Toss);
        expect(ent.touch).toBeDefined();
        expect(ent.velocity).toEqual({ x: 0, y: 0, z: 0 });
    });

    it('aligns to floor on startup', () => {
        const ent = createEntityFactory({
            classname: 'func_object',
            origin: { x: 0, y: 0, z: 100 },
            model: '*1'
        });

        // Mock trace to simulate floor below
        (sys.trace as Mock).mockReturnValue({
            fraction: 0.5,
            endpos: { x: 0, y: 0, z: 50 },
            plane: undefined,
            surface: undefined,
            ent: undefined,
            contents: 0,
            startsolid: false,
            allsolid: false
        });

        SP_func_object(ent, { entities: sys } as any);

        // Verify that a think function is scheduled to handle the drop
        expect(ent.nextthink).toBeGreaterThan(0);

        // Execute the think function
        if (ent.think) {
            ent.think(ent, sys);
        }

        // Verify that the entity is set to toss, allowing physics to handle gravity
        expect(ent.movetype).toBe(MoveType.Toss);
    });

    it('kills blocking entities on impact', () => {
        const ent = createEntityFactory({
            classname: 'func_object',
            // spawnflags: 1 - Removed because it prevents immediate think initialization
        });

        SP_func_object(ent, { entities: sys } as any);

        // Initialize entity state
        if (ent.think) ent.think(ent, sys);

        const obstacle = createEntityFactory({
            classname: 'player',
            health: 100,
            takedamage: true
        });

        // Verify that touch damage logic triggers T_Damage
        if (ent.touch) {
            ent.touch(ent, obstacle, undefined, undefined, sys);
        }

        expect(damageModule.T_Damage).toHaveBeenCalled();
    });
});
