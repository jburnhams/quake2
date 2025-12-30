import {
  SpawnRegistry,
  createDefaultSpawnRegistry,
  type SpawnFunction,
  type SpawnContext,
  type SpawnOptions,
  spawnEntityFromDictionary,
  Entity
} from '@quake2ts/game';
import type { TestContext } from '../helpers.js';

/**
 * Creates a configured SpawnRegistry for testing.
 * Uses the default spawn registry but handles the game dependency if not provided.
 */
export function createSpawnRegistry(game?: any): SpawnRegistry {
  // If game is not provided, we can pass a mock or empty object
  // The default registry primarily uses game for registering items
  const gameMock = game || {};
  return createDefaultSpawnRegistry(gameMock);
}

/**
 * Registers a custom spawn function for testing.
 */
export function registerTestSpawn(
  registry: SpawnRegistry,
  classname: string,
  spawnFunc: SpawnFunction
): void {
  registry.register(classname, spawnFunc);
}

export interface SpawnTestEntityOptions {
  classname: string;
  keyValues?: Record<string, string>;
  registry?: SpawnRegistry;
  onWarning?: (message: string) => void;
}

/**
 * Convenience function to spawn an entity using the spawn system.
 */
export function spawnTestEntity(
  context: TestContext,
  options: SpawnTestEntityOptions
): Entity | null {
  const registry = options.registry || context.game?.entities?.spawnRegistry;

  if (!registry) {
    throw new Error('No spawn registry provided and none found on context.game.entities');
  }

  const keyValues = {
    classname: options.classname,
    ...(options.keyValues || {})
  };

  const spawnOptions: SpawnOptions = {
    registry,
    entities: context.entities,
    onWarning: options.onWarning
  };

  // The type of spawnEntityFromDictionary might need validation based on exports
  // but usually it accepts Record<string,string> which we provide.
  return spawnEntityFromDictionary(keyValues, spawnOptions);
}
