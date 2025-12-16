import { Entity } from './entities/entity.js';
import { ScriptHooks } from './scripting/hooks.js';

export { ScriptHooks };

/**
 * Mod API for registering custom entities and hooks.
 */
export interface ModAPI {
  registerEntity(classname: string, spawnFunc: (entity: Entity) => void): void;
  registerHooks(hooks: ScriptHooks): () => void;
}

/**
 * Interface extension for GameExports to support custom entity registration and hooks
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

  /**
   * Register script hooks.
   * @returns A cleanup function to unregister the hooks.
   */
  registerHooks(hooks: ScriptHooks): () => void;
}
