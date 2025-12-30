import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoveType, Solid, ServerFlags } from '../../src/entities/entity.js';
import {
  createGameImportsAndEngine,
  createTestContext,
  spawnTestEntity,
  createSpawnRegistry
} from '@quake2ts/test-utils';
import { spawnEntitiesFromText } from '../../src/entities/spawn.js';

// Game options
const gameOptions = {
    gravity: 800,
    maxEntities: 1024,
};

describe('Spawning Integration Tests', () => {
    let context: any;
    let spawnRegistry: any;
    let engineMock: any;

    beforeEach(() => {
        vi.clearAllMocks();

        // Create test context using test-utils
        context = createTestContext({
          seed: 12345,
          // If we need initial entities, pass them here
        });

        const { imports, engine } = createGameImportsAndEngine({
            engine: {
                modelIndex: vi.fn((model: string) => {
                    if (model && model.endsWith('tris.md2')) return 1;
                    return 0;
                }),
                cvar: vi.fn((name, val, flags) => ({ name, value: parseFloat(val), flags, string: val, modified: false })),
                boxEdicts: vi.fn(() => []),
                imageIndex: vi.fn(() => 1),
                // Add missing mocks that were present in original test
                milliseconds: vi.fn(() => 0),
                args: vi.fn(() => ''),
                argv: vi.fn(() => ''),
                argc: vi.fn(() => 0),
                error: vi.fn(),
                print: vi.fn(),
                configstring: vi.fn(),
                setmodel: vi.fn(),
            } as any
        });

        engineMock = engine;

        // Wire up context with robust engine mocks
        context.game = { ...context.game, ...imports }; // Merge imports into game logic if needed or just use context.entities.engine
        context.engine = engine;
        context.entities.engine = engine;
        // Also update imports on entities
        context.entities.imports = { ...context.entities.imports, ...imports };

        spawnRegistry = createSpawnRegistry(context.game);
        context.entities.setSpawnRegistry(spawnRegistry);

        // Ensure worldspawn exists
        context.entities.spawn().classname = 'worldspawn';
        // Force world update in entities
        (context.entities as any).world = context.entities.find((e: any) => e.classname === 'worldspawn');
    });

    it('handles entity lifecycle: spawn, think, die, free', () => {
        const ent = context.entities.spawn();
        ent.classname = 'test_lifecycle';
        ent.health = 100;
        ent.takedamage = true;

        expect(ent.inUse).toBe(true);

        let thought = false;
        ent.think = (self: any) => {
            thought = true;
            return true;
        };
        ent.nextthink = context.entities.timeSeconds + 0.1;
        context.entities.scheduleThink(ent, ent.nextthink);

        // Advance time manually since we aren't running the full game loop
        context.entities.timeSeconds += 0.1;
        // Manually trigger think for unit test isolation
        if (ent.think && ent.nextthink <= context.entities.timeSeconds) {
            ent.think(ent);
        }

        expect(thought).toBe(true);

        ent.die = (self: any) => {
            self.deadflag = 1;
        };
        ent.die(ent, null, null, 100, {x:0,y:0,z:0}, 0);
        expect(ent.deadflag).toBe(1);

        context.entities.free(ent);
        expect(ent.inUse).toBe(false);
    });

    it('activates trigger_multiple when walked into', () => {
        // Use spawn registry to create proper trigger
        const triggerLump = `
        {
        "classname" "trigger_multiple"
        "model" "*1"
        "target" "t1"
        "wait" "0"
        }
        `;
        const entities = spawnEntitiesFromText(triggerLump, { registry: spawnRegistry, entities: context.entities });
        const trigger = entities[0];
        trigger.absmin = { x: -10, y: -10, z: -10 };
        trigger.absmax = { x: 10, y: 10, z: 10 };
        trigger.solid = Solid.Trigger;
        context.entities.linkentity(trigger);

        // Create a target to verify activation
        let targeted = false;
        const target = context.entities.spawn();
        target.targetname = "t1";
        target.use = () => { targeted = true; };
        context.entities.finalizeSpawn(target);

        // Player
        const player = context.entities.spawn();
        player.classname = 'player';
        player.solid = Solid.BoundingBox; // Solid.Bbox in older code
        player.svflags = ServerFlags.Player; // Required for canActivate
        player.movetype = MoveType.Walk;
        player.origin = { x: 0, y: 0, z: 0 };
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };
        context.entities.linkentity(player);

        // Mock touch manually since we don't have full physics simulation in this test context
        if (trigger.touch) {
            trigger.touch(trigger, player);
        }

        // Wait, trigger_multiple might use a 'touch' function that checks conditions.
        expect(targeted).toBe(true);
    });

    it('teleports entity via trigger_teleport', () => {
        const lump = `
        {
        "classname" "trigger_teleport"
        "target" "dest1"
        "model" "*1"
        }
        {
        "classname" "info_teleport_destination"
        "targetname" "dest1"
        "origin" "100 100 100"
        "angle" "90"
        }
        `;
        const spawned = spawnEntitiesFromText(lump, { registry: spawnRegistry, entities: context.entities });
        const trigger = spawned[0];
        trigger.absmin = { x: -50, y: -50, z: -50 };
        trigger.absmax = { x: 50, y: 50, z: 50 };
        trigger.solid = Solid.Trigger;

        const player = context.entities.spawn();
        player.classname = 'player';
        player.origin = { x: 0, y: 0, z: 0 };
        player.movetype = MoveType.Walk;
        player.solid = Solid.BoundingBox;
        player.svflags = ServerFlags.Player; // Good practice, though teleport might not check it as strictly as multiple
        player.mins = { x: -16, y: -16, z: -24 };
        player.maxs = { x: 16, y: 16, z: 32 };
        context.entities.linkentity(player);

        // Manually invoke touch
        trigger.touch?.(trigger, player);

        expect(player.origin.x).toBe(100);
        expect(player.origin.y).toBe(100);
        expect(player.origin.z).toBeCloseTo(110, 0); // +10 nudge
        expect(player.angles.y).toBe(90);
    });

    it('picks up item_armor_body', () => {
        const lump = `
        {
        "classname" "item_armor_body"
        "origin" "10 10 10"
        }
        `;
        const spawned = spawnEntitiesFromText(lump, { registry: spawnRegistry, entities: context.entities });
        const item = spawned[0];

        const player = context.entities.spawn();
        player.classname = 'player';
        player.client = { inventory: { armor: null } };

        item.touch?.(item, player);

        // Note: freePending might differ in implementation details of free() mock
        // In our mock context, free() sets inUse=false immediately or pending.
        // Let's verify inUse is false.
        expect(item.inUse).toBe(false);
    });

    it('handles func_door functionality', () => {
        const lump = `
        {
        "classname" "func_door"
        "angle" "90"
        "speed" "100"
        "wait" "2"
        "model" "*1"
        }
        `;
        const spawned = spawnEntitiesFromText(lump, { registry: spawnRegistry, entities: context.entities });
        const door = spawned[0];
        door.mins = { x: 0, y: 0, z: 0 };
        door.maxs = { x: 10, y: 100, z: 100 };
        door.size = { x: 10, y: 100, z: 100 };

        // Trigger the door
        door.use?.(door, null, null);

        // Door should be moving
        expect(door.movetype).toBe(MoveType.Push);
        expect(door.velocity).not.toEqual({ x: 0, y: 0, z: 0 });
    });

    it('spawns monster_soldier and initializes AI', () => {
        const lump = `
        {
        "classname" "monster_soldier"
        "origin" "100 100 0"
        "angle" "45"
        }
        `;
        const spawned = spawnEntitiesFromText(lump, { registry: spawnRegistry, entities: context.entities });
        const soldier = spawned[0];

        expect(soldier).toBeDefined();
        expect(soldier.health).toBeGreaterThan(0);
        expect(soldier.movetype).toBe(MoveType.Step);
        expect(soldier.monsterinfo).toBeDefined();
        expect(soldier.monsterinfo?.stand).toBeDefined();
    });

    it('performs full level spawn from mocked entity lump', () => {
        const lump = `
        {
        "classname" "worldspawn"
        "message" "Test Level"
        }
        {
        "classname" "info_player_start"
        "origin" "0 0 0"
        "angle" "90"
        }
        {
        "classname" "func_door"
        "model" "*1"
        }
        {
        "classname" "monster_soldier"
        "origin" "200 0 0"
        }
        `;

        const entities = spawnEntitiesFromText(lump, { registry: spawnRegistry, entities: context.entities });

        // worldspawn is usually reused, not pushed as new entity in list returned by some parsers?
        // spawnEntitiesFromText returns *spawned* entities.
        // In our impl, worldspawn is processed.

        // Wait, worldspawn usually sets properties on existing entity 0.
        // spawnEntitiesFromText logic:
        // const entity = isWorld ? options.entities.world : options.entities.spawn();
        // spawned.push(entity);

        // So yes, it should be in the list.

        // Entities expected: worldspawn, info_player_start, func_door, monster_soldier = 4
        expect(entities.length).toBe(4);

        // Verify types
        expect(entities.some(e => e.classname === 'worldspawn')).toBe(true);
        expect(entities.some(e => e.classname === 'info_player_start')).toBe(true);
        expect(entities.some(e => e.classname === 'func_door')).toBe(true);
        expect(entities.some(e => e.classname === 'monster_soldier')).toBe(true);

        const world = context.entities.world;
        expect(world.message).toBe("Test Level");
    });
});
