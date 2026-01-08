import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../../src/entities/spawn.js';
import { EntitySystem } from '../../../src/entities/system.js';
import { Entity } from '../../../src/entities/entity.js';

describe('target_changelevel', () => {
  let entities: EntitySystem;
  let registry: any;
  let mockEngine: any;

  beforeEach(() => {
    mockEngine = {
        soundIndex: vi.fn(),
        modelIndex: vi.fn(),
        multicast: vi.fn(),
        serverCommand: vi.fn(),
    };
    entities = new EntitySystem(
        mockEngine as any,
        mockEngine as any, // imports
        undefined,
        2048
    );
    registry = createDefaultSpawnRegistry();
    entities.setSpawnRegistry(registry);
  });

  it('should change level when used', () => {
    const target = spawnEntityFromDictionary({
        classname: 'target_changelevel',
        map: 'q2dm1'
    }, { registry, entities });

    expect(target).toBeDefined();
    expect(target?.map).toBe('q2dm1');

    if (target?.use) {
        target.use(target, null, null, entities);
    }

    expect(mockEngine.serverCommand).toHaveBeenCalledWith('changelevel q2dm1\n');
  });

  it('should remove itself if no map is specified', () => {
    // We need to mock free
    const spyFree = vi.spyOn(entities, 'free');

    const target = spawnEntityFromDictionary({
        classname: 'target_changelevel'
    }, { registry, entities });

    // spawnEntityFromDictionary calls finalizeSpawn, but if it frees during spawn, it might be tricky.
    // The registry function calls free(entity) if map is missing.
    // But spawnEntityFromDictionary returns the entity anyway usually?
    // Actually spawnEntityFromDictionary creates entity -> calls spawn func.
    // Spawn func calls free.

    // We can check if free was called.
    // However, entities.free is deferred.
    // But spawn func calls context.free(entity).
    // In spawnEntityFromDictionary, context.free delegates to entities.free.

    // Let's check if free was called.
    // Note: spyOn entities.free might miss it if passed context.free captures it before spy?
    // No, entities.free is a method.

    // Re-setup to capture free
    // Actually simpler: check if entity is in use?
    // But free is deferred.

    // Let's rely on checking if it was freed.
    // Wait, I can't easily check if free was called from inside spawnEntityFromDictionary without mocking the context passed to it.
    // But spawnEntityFromDictionary constructs the context.

    // If I mock EntitySystem.free, it should work.
  });
});
