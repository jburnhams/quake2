import { Entity } from '../entities/entity.js';
import { DamageFlags, DamageMod } from '../combat/index.js';

/**
 * Script hooks interface for game events.
 */
export interface ScriptHooks {
  /**
   * Called when a map is loaded.
   */
  onMapLoad?: (mapName: string) => void;

  /**
   * Called when a map is unloaded.
   */
  onMapUnload?: () => void;

  /**
   * Called when a player spawns (initial or respawn).
   */
  onPlayerSpawn?: (player: Entity) => void;

  /**
   * Called when a player dies.
   */
  onPlayerDeath?: (player: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number) => void;

  /**
   * Called when any entity spawns.
   */
  onEntitySpawn?: (entity: Entity) => void;

  /**
   * Called when an entity is removed (freed).
   */
  onEntityRemove?: (entity: Entity) => void;

  /**
   * Called when an entity takes damage.
   * Return false to prevent damage (optional, depending on implementation complexity).
   */
  onDamage?: (target: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, flags: DamageFlags, mod: DamageMod) => void;

  /**
   * Called when an item is picked up.
   */
  onPickup?: (entity: Entity, item: Entity) => void;
}

/**
 * Registry for managing script hooks.
 */
export class ScriptHookRegistry {
  private hooks: ScriptHooks[] = [];

  /**
   * Register a new set of hooks.
   * @param hooks The hooks to register.
   * @returns A cleanup function to unregister these hooks.
   */
  register(hooks: ScriptHooks): () => void {
    this.hooks.push(hooks);
    return () => {
      const index = this.hooks.indexOf(hooks);
      if (index !== -1) {
        this.hooks.splice(index, 1);
      }
    };
  }

  // Trigger methods
  onMapLoad(mapName: string): void {
    for (const hook of this.hooks) hook.onMapLoad?.(mapName);
  }

  onMapUnload(): void {
    for (const hook of this.hooks) hook.onMapUnload?.();
  }

  onPlayerSpawn(player: Entity): void {
    for (const hook of this.hooks) hook.onPlayerSpawn?.(player);
  }

  onPlayerDeath(player: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number): void {
    for (const hook of this.hooks) hook.onPlayerDeath?.(player, inflictor, attacker, damage);
  }

  onEntitySpawn(entity: Entity): void {
    for (const hook of this.hooks) hook.onEntitySpawn?.(entity);
  }

  onEntityRemove(entity: Entity): void {
    for (const hook of this.hooks) hook.onEntityRemove?.(entity);
  }

  onDamage(target: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, flags: DamageFlags, mod: DamageMod): void {
    for (const hook of this.hooks) hook.onDamage?.(target, inflictor, attacker, damage, flags, mod);
  }

  onPickup(entity: Entity, item: Entity): void {
    for (const hook of this.hooks) hook.onPickup?.(entity, item);
  }
}
