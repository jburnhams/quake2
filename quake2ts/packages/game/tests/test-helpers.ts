import { vi } from 'vitest';
import { Entity } from '../src/entities/entity.js';
import type { SpawnContext } from '../src/entities/spawn.js';
import type { EntitySystem } from '../src/entities/system.js';
import { createRandomGenerator } from '@quake2ts/shared';
import { SpawnRegistry } from '../src/entities/spawn.js';
import { ScriptHookRegistry } from '../src/scripting/hooks.js';
import { createTestContext as createTestContextUtils } from '@quake2ts/test-utils';

export function createTestContext(options?: { seed?: number }): { entities: EntitySystem, game: any } & SpawnContext {
  // Use the test-utils implementation but ensure we maintain any specific overrides if they existed.
  // The original implementation here was nearly identical to test-utils.

  // We need to match the return type structure expected by existing tests.
  // test-utils returns: TestContext which is SpawnContext & { entities, game, engine }

  return createTestContextUtils(options);
}

export function createSpawnContext(): SpawnContext {
    return createTestContext();
}

export function createEntity(): Entity {
    return new Entity(1);
}
