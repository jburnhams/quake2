import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { registerMiscBigViper } from '../../../src/entities/misc/flyers.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';

describe('misc_bigviper', () => {
    let registry: SpawnRegistry;
    let context: any;
    let spawnFunction: (entity: Entity, context: any) => void;

    beforeEach(() => {
        registry = new SpawnRegistry();
        registerMiscBigViper(registry);
        // Extract the registered spawn function for 'misc_bigviper'
        spawnFunction = (registry as any).registry.get('misc_bigviper');

        context = createTestContext();
    });

    it('should register misc_bigviper', () => {
        expect(spawnFunction).toBeDefined();
    });

    it('should set correct properties on spawn', () => {
        const entity = new Entity();
        entity.classname = 'misc_bigviper';

        spawnFunction(entity, context);

        expect(entity.movetype).toBe(MoveType.None);
        expect(entity.solid).toBe(Solid.BoundingBox);
        expect(entity.mins).toEqual({ x: -176, y: -120, z: -24 });
        expect(entity.maxs).toEqual({ x: 176, y: 120, z: 72 });
        expect(context.entities.modelIndex).toHaveBeenCalledWith('models/ships/bigviper/tris.md2');
        expect(context.entities.linkentity).toHaveBeenCalledWith(entity);
    });
});
