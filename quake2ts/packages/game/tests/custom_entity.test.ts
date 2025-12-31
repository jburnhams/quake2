import { EntitySystem, SpawnFunction, createDefaultSpawnRegistry } from '@quake2ts/game';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestContext } from '@quake2ts/test-utils/game/helpers';

describe('Custom Entity Registration', () => {
  let context: EntitySystem;

  beforeEach(() => {
    // createTestContext provides a mocked EntitySystem with a valid (but possibly empty) registry via setSpawnRegistry mock.
    // However, if we want to test REAL registry behavior (like registerEntityClass storing it),
    // we should use a real EntitySystem or ensure the mock behaves as expected.
    // The previous test code manually set a real registry. Let's maintain that approach
    // but cleaner using test-utils features if possible.
    // createTestContext from test-utils mocks entities.spawn but returns a type asserting EntitySystem.
    // If we want a REAL EntitySystem for integration testing registry logic, we should probably construct it
    // or assume createTestContext gives us enough.
    //
    // Looking at the previous code:
    // const testContext = createTestContext();
    // context = testContext.entities;
    // context.setSpawnRegistry(registry);
    //
    // createTestContext implementation creates a mocked entities object with jest/vi functions.
    // So 'registerEntityClass' is a mock.
    // The previous test was actually testing the MOCK's ability to be called, not the real system logic?
    // Wait, createTestContext in test-utils shows:
    // entities = { ... registerEntityClass: vi.fn(), ... }
    //
    // If the test above passed, it means it was testing the mock or I misread the previous file content.
    //
    // Let's re-read the previous file content provided in memory.
    // It used: `context = testContext.entities`.
    // And `context.setSpawnRegistry(registry)`.
    //
    // If `context` is the mock from `createTestContext`, `setSpawnRegistry` is a mock.
    // `registerEntityClass` is a mock.
    // `getSpawnFunction` is a mock.
    //
    // `createTestContext` implementation:
    // registerEntityClass: vi.fn((classname: string, factory: any) => { if (currentSpawnRegistry) currentSpawnRegistry.register(...) }),
    //
    // So the mock DELEGATES to a real registry if `currentSpawnRegistry` is set via `setSpawnRegistry`.
    // This allows testing the interaction.
    //
    // Refactoring plan: Keep usage of `createTestContext` but ensure it is using the latest import.

    const testContext = createTestContext();
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
    expect(entity.message).toBe('Hello Custom'); // My mock overrides it
  });
});
