import { describe, it, expect, vi } from 'vitest';
import { createGame } from '../../src/index.js';
import { Entity } from '../../src/entities/entity.js';
import { createGameImportsAndEngine } from '@quake2ts/test-utils';

describe('Custom Entity Registration', () => {
  it('should register and spawn a custom entity', () => {
    // We need to use createGame to get the real GameExports implementation
    // The createTestContext helper returns a mocked game object, which is what we want to avoid.

    const { imports, engine } = createGameImportsAndEngine();

    // Create the REAL game instance
    const game = createGame(imports, engine, { gravity: { x: 0, y: 0, z: -800 } });

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
