import { Entity } from './entities/entity.js';
import { SpawnRegistry, SpawnContext } from './entities/spawn.js';

/**
 * Mod API for registering custom entities and commands.
 */
export interface ModAPI {
  registerEntity(classname: string, spawnFunc: (entity: Entity) => void): void;
  // TODO: registerCommand, registerCvar in future
}

/**
 * Interface extension for GameExports to support custom entity registration
 */
export interface CustomEntityRegistration {
  /**
   * Register custom entity spawn function
   * Mods can add new entity types
   */
  registerEntitySpawn(
    classname: string,
    spawnFunc: (entity: Entity) => void
  ): void;

  /**
   * Unregister entity spawn function (for mod unloading)
   */
  unregisterEntitySpawn(classname: string): void;

  /**
   * Get list of registered custom entities
   */
  getCustomEntities(): string[];
}
