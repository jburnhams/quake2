import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTargetSpawns } from '../../src/entities/targets.js';
import { Entity, MoveType, ServerFlags, Solid } from '../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';
import { SpawnRegistry } from '../../src/entities/spawn.js';
import { T_Damage } from '../../src/combat/damage.js';
import { DamageFlags } from '../../src/combat/damageFlags.js';
import { DamageMod } from '../../src/combat/damageMods.js';
import { TempEntity, ServerCommand, RenderFx } from '@quake2ts/shared';
import { createEntityFactory } from '@quake2ts/test-utils';

// Mock T_Damage
vi.mock('../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

describe('target_laser', () => {
    let context: ReturnType<typeof createTestContext>;
    let entity: Entity;
    let registry: SpawnRegistry;

    beforeEach(() => {
        context = createTestContext();
        registry = new SpawnRegistry();
        registerTargetSpawns(registry);

        entity = createEntityFactory({
            number: 1,
            classname: 'target_laser',
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        });
        vi.clearAllMocks();
    });

    it('should initialize correctly via start think', () => {
        const spawnFn = registry.get('target_laser');
        expect(spawnFn).toBeDefined();
        spawnFn?.(entity, context);

        expect(entity.nextthink).toBeGreaterThan(0);
        expect(entity.think).toBeDefined();

        // Run the start think
        const startThink = entity.think!;
        // Assuming context time is 0 or whatever default
        startThink(entity);

        expect(entity.movetype).toBe(MoveType.None);
        expect(entity.solid).toBe(Solid.Not);
        expect(entity.renderfx & RenderFx.Beam).toBeTruthy();
        expect(entity.modelindex).toBe(1);
        expect(entity.movedir.x).toBeCloseTo(1);

        // Defaults
        expect(entity.dmg).toBe(1);
        expect(entity.spawnflags & 1).toBeFalsy(); // Default off
        expect(entity.svflags & ServerFlags.NoClient).toBeTruthy(); // Off implies NoClient
    });

    it('should start ON if spawnflag 1 is set', () => {
        entity.spawnflags = 1; // START_ON
        const spawnFn = registry.get('target_laser');
        spawnFn?.(entity, context);

        const startThink = entity.think!;
        startThink(entity);

        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy(); // Should be visible
        expect(entity.nextthink).toBeGreaterThan(0); // Should be thinking
    });

    it('should calculate damage when hitting entities', () => {
        entity.spawnflags = 1; // START_ON
        const spawnFn = registry.get('target_laser');
        spawnFn?.(entity, context);
        entity.think!(entity); // Start

        // Mock trace to hit something
        const victim = new Entity(2);
        victim.takedamage = true;

        context.entities.trace = vi.fn().mockReturnValue({
            ent: victim,
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } }
        });

        // Run think
        const think = entity.think!;
        think(entity);

        expect(T_Damage).toHaveBeenCalledWith(
            victim,
            entity,
            entity.activator, // might be undefined or self
            expect.anything(), // dir (relaxed check for -0)
            expect.any(Object), // point
            expect.any(Object), // normal
            1, // damage
            1, // kick
            DamageFlags.ENERGY,
            DamageMod.TARGET_LASER,
            expect.any(Number)
        );
    });

    it('should spawn sparks when hitting solid (non-monster)', () => {
        entity.spawnflags = 1 | 0x80000000; // START_ON + tracking bit (to force count=8?)
        // Actually the code sets 0x80000000 in think if it's tracking enemy.
        // But for sparks logic: if self.spawnflags & 0x80000000 then count=8 else 4.

        const spawnFn = registry.get('target_laser');
        spawnFn?.(entity, context);
        entity.think!(entity);

        // Mock trace to hit wall
        const wall = new Entity(3);
        wall.solid = Solid.Bsp;
        // Not monster, not client

        context.entities.trace = vi.fn().mockReturnValueOnce({
            ent: wall,
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 } }
        }).mockReturnValue({ // Break loop
             ent: null
        });

        // Force sparks condition (if self.spawnflags & 0x80000000)
        // Wait, the spark spawning code:
        // if (self->spawnflags & 0x80000000) { ... multicast ... }
        // This bit is set if tracking an enemy changed direction?
        // Or wait, looking at my code:
        // if (self.spawnflags & 0x80000000) { ... multicast ... }
        // Yes.
        // So we need to set that bit manually to test sparks?
        // Or satisfy the condition "if (!VectorCompare(self->movedir, last_movedir)) self->spawnflags |= 0x80000000;"
        // Or if I just set it manually.
        entity.spawnflags |= 0x80000000;

        const think = entity.think!;
        think(entity);

        expect(context.entities.multicast).toHaveBeenCalledWith(
            expect.any(Object),
            expect.anything(),
            ServerCommand.temp_entity,
            TempEntity.LASER_SPARKS,
            expect.any(Number),
            expect.any(Object),
            expect.any(Object),
            expect.any(Number)
        );
    });

    it('should toggle off/on when used', () => {
        entity.spawnflags = 1; // Start ON
        const spawnFn = registry.get('target_laser');
        spawnFn?.(entity, context);
        entity.think!(entity); // Init

        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();

        // Use -> Toggle Off
        entity.use!(entity, null, null);
        expect(entity.svflags & ServerFlags.NoClient).toBeTruthy();
        expect(entity.nextthink).toBe(0);

        // Use -> Toggle On
        entity.use!(entity, null, null);
        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy();
        expect(entity.nextthink).toBeGreaterThan(0);
    });
});
