import { EntitySystem, SpawnFunction, createDefaultSpawnRegistry } from '@quake2ts/game';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameEngine, GameImports } from '../src/imports.js';
import { createRandomGenerator } from '@quake2ts/shared';

describe('Custom Entity Registration', () => {
  let context: EntitySystem;
  let engine: GameEngine;
  let imports: GameImports;

  beforeEach(() => {
    // Setup a mock engine
    engine = {
      sound: vi.fn(),
      soundIndex: vi.fn(() => 0),
      modelIndex: vi.fn(() => 0),
      centerprintf: vi.fn(),
    } as unknown as GameEngine;

    imports = {
        trace: vi.fn(() => ({
            fraction: 1.0,
            ent: null,
            allsolid: false,
            startsolid: false,
            endpos: { x: 0, y: 0, z: 0 },
            plane: null,
            surfaceFlags: 0,
            contents: 0
        })),
        pointcontents: vi.fn(() => 0),
        linkentity: vi.fn(),
        multicast: vi.fn(),
        unicast: vi.fn(),
        configstring: vi.fn(),
        serverCommand: vi.fn(),
        areaEdicts: vi.fn(() => null),
    } as unknown as GameImports;

    context = new EntitySystem(engine, imports, { x: 0, y: 0, z: -800 });

    // Important: The entity system needs a spawn registry to work with registerEntityClass
    const registry = createDefaultSpawnRegistry({});
    context.setSpawnRegistry(registry);
  });

  it('should allow registering a custom spawn function', () => {
    const customSpawn = vi.fn();

    context.registerEntityClass('info_custom', customSpawn);

    // Test if we can retrieve it
    const retrieved = context.getSpawnFunction('info_custom');
    expect(retrieved).toBe(customSpawn);
  });

  it('should spawn a custom entity via map parsing simulation', () => {
    // Register custom entity
    const customSpawn: SpawnFunction = (entity, ctx) => {
        entity.classname = 'info_custom';
        entity.message = 'Hello Custom';
    };

    context.registerEntityClass('info_custom', customSpawn);

    // Simulate spawning from map data
    const mapData = {
        classname: 'info_custom',
        origin: '100 0 0',
        message: 'Override'
    };

    const spawnFunc = context.getSpawnFunction('info_custom');
    expect(spawnFunc).toBeDefined();

    const entity = context.spawn();

    if (spawnFunc) {
        spawnFunc(entity, {
            keyValues: mapData,
            entities: context,
            health_multiplier: 1,
            warn: (msg) => console.warn(msg),
            free: (e) => context.free(e)
        });
    }

    expect(entity.classname).toBe('info_custom');
    expect(entity.message).toBe('Hello Custom'); // My mock overrides it
  });
});
