import { Entity } from '../entities/entity.js';

export interface ScriptHooks {
  // Lifecycle
  onMapLoad?: (mapName: string) => void;
  onMapUnload?: () => void;

  // Player
  onPlayerSpawn?: (player: Entity) => void;
  onPlayerDeath?: (player: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number) => void;

  // Entities
  onEntitySpawn?: (entity: Entity) => void;
  onEntityRemove?: (entity: Entity) => void;
  onDamage?: (target: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number) => void;
  onPickup?: (player: Entity, item: string) => void;
}

export class ScriptHookRegistry {
  private hooks: ScriptHooks = {};

  register(hooks: ScriptHooks) {
    this.hooks = { ...this.hooks, ...hooks };
  }

  // Getters for specific hooks to avoid full object access if performance critical
  get onMapLoad() { return this.hooks.onMapLoad; }
  get onMapUnload() { return this.hooks.onMapUnload; }
  get onPlayerSpawn() { return this.hooks.onPlayerSpawn; }
  get onPlayerDeath() { return this.hooks.onPlayerDeath; }
  get onEntitySpawn() { return this.hooks.onEntitySpawn; }
  get onEntityRemove() { return this.hooks.onEntityRemove; }
  get onDamage() { return this.hooks.onDamage; }
  get onPickup() { return this.hooks.onPickup; }
}
