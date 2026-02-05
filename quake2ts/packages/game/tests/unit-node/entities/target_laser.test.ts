import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity, MoveType, ServerFlags, Solid } from '../../../src/entities/entity.js';
import { createTestGame, spawnEntity, createEntityFactory } from '@quake2ts/test-utils';
import { T_Damage } from '../../../src/combat/damage.js';
import { DamageFlags } from '../../../src/combat/damageFlags.js';
import { DamageMod } from '../../../src/combat/damageMods.js';
import { TempEntity, ServerCommand, RenderFx } from '@quake2ts/shared';
import type { GameExports } from '../../../src/index.js';
import type { MockImportsAndEngine } from '@quake2ts/test-utils';
import type { SpawnContext } from '../../../src/entities/spawn.js';

// Mock T_Damage
vi.mock('../../../src/combat/damage.js', () => ({
    T_Damage: vi.fn(),
}));

describe('target_laser', () => {
    let game: GameExports;
    let imports: MockImportsAndEngine['imports'];
    let entity: Entity;
    let spawnContext: SpawnContext;

    beforeEach(() => {
        const result = createTestGame();
        game = result.game;
        imports = result.imports;

        entity = spawnEntity(game.entities, createEntityFactory({
            classname: 'target_laser',
            angles: { x: 0, y: 0, z: 0 },
            origin: { x: 0, y: 0, z: 0 }
        }));

        spawnContext = {
            keyValues: {},
            entities: game.entities,
            health_multiplier: 1,
            warn: vi.fn(),
            free: (e) => game.entities.free(e)
        };

        vi.clearAllMocks();
    });

    it('should initialize correctly via start think', () => {
        const spawnFn = game.entities.getSpawnFunction('target_laser');
        expect(spawnFn).toBeDefined();
        spawnFn?.(entity, spawnContext);

        expect(entity.nextthink).toBeGreaterThan(0);
        expect(entity.think).toBeDefined();

        // Run the start think
        const startThink = entity.think!;
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
        const spawnFn = game.entities.getSpawnFunction('target_laser');
        spawnFn?.(entity, spawnContext);

        const startThink = entity.think!;
        startThink(entity);

        expect(entity.svflags & ServerFlags.NoClient).toBeFalsy(); // Should be visible
        expect(entity.nextthink).toBeGreaterThan(0); // Should be thinking
    });

    it('should calculate damage when hitting entities', () => {
        entity.spawnflags = 1; // START_ON
        const spawnFn = game.entities.getSpawnFunction('target_laser');
        spawnFn?.(entity, spawnContext);
        entity.think!(entity); // Start

        // Mock trace to hit something
        const victim = spawnEntity(game.entities, createEntityFactory({
            takedamage: true
        }));

        // Mock the trace implementation
        imports.trace.mockReturnValue({
            ent: victim,
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
            allsolid: false,
            startsolid: false,
            contents: 0,
            surfaceFlags: 0
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
            expect.any(Number) // time
        );
    });

    it('should spawn sparks when hitting solid (non-monster)', () => {
        // Set START_ON (1) and tracking bit (0x80000000) to force spark generation logic
        entity.spawnflags = 1 | 0x80000000;

        const spawnFn = game.entities.getSpawnFunction('target_laser');
        spawnFn?.(entity, spawnContext);
        entity.think!(entity);

        // Mock trace to hit wall
        const wall = new Entity(3);
        wall.solid = Solid.Bsp;

        imports.trace.mockReturnValueOnce({
            ent: wall,
            fraction: 0.5,
            endpos: { x: 50, y: 0, z: 0 },
            plane: { normal: { x: -1, y: 0, z: 0 }, dist: 0, type: 0, signbits: 0 },
             allsolid: false,
            startsolid: false,
            contents: 0,
            surfaceFlags: 0
        }).mockReturnValue({ // Break loop
             ent: null,
            fraction: 1.0,
            endpos: { x: 100, y: 0, z: 0 },
            plane: null,
             allsolid: false,
            startsolid: false,
            contents: 0,
            surfaceFlags: 0
        });

        entity.spawnflags |= 0x80000000;

        const think = entity.think!;
        think(entity);

        expect(imports.multicast).toHaveBeenCalledWith(
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
        const spawnFn = game.entities.getSpawnFunction('target_laser');
        spawnFn?.(entity, spawnContext);
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
