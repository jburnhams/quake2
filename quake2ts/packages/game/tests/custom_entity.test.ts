import { EntitySystem, SpawnFunction, createDefaultSpawnRegistry } from '@quake2ts/game';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils';

describe('Custom Entity Registration', () => {
  let context: EntitySystem;
  let testContext: ReturnType<typeof createTestContext>;

  beforeEach(() => {
    testContext = createTestContext();
    context = testContext.entities;

    // Use a real registry to test the delegation
    const registry = createDefaultSpawnRegistry(testContext.engine);
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
    expect(entity.message).toBe('Hello Custom');
  });
});
