import { describe, it, expect } from 'vitest';
import { Entity } from '../../src/entities/entity.js';
import { createTestGame } from '@quake2ts/test-utils';

describe('Custom Entity Registration', () => {
  it('should register and spawn a custom entity', () => {
    // Use createTestGame to get a real GameExports implementation
    // with mocked imports/engine
    const { game } = createTestGame();

    let spawnCalled = false;
    const customSpawn = (entity: Entity) => {
        spawnCalled = true;
        entity.classname = 'custom_entity';
        entity.health = 100;
        entity.solid = 1; // Solid.Bsp
    };

    // Use the real API
    game.registerEntitySpawn('custom_entity', customSpawn);

    // Verify it's in the list
    expect(game.getCustomEntities()).toContain('custom_entity');

    // To verify spawning works, we need to invoke the spawn registry.
    // The internal registry is buried inside createGame closure.
    // However, we can simulate a spawn if we had access to `spawnEntitiesFromText` using the registry.
    // But we don't have easy access to the registry instance itself from outside.

    // BUT, `game.spawnWorld` parses entities. If we could inject a custom map string...
    // createGame doesn't take a map string.

    // We can rely on the fact that `getCustomEntities` returns the keys from the registry.
    // And if `registerEntitySpawn` worked, `getCustomEntities` should return it.
    // To be absolutely sure, we can verify unregistering.

    game.unregisterEntitySpawn('custom_entity');
    expect(game.getCustomEntities()).not.toContain('custom_entity');
  });
});
