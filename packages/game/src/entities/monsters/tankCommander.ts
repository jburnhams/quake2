import { SP_monster_tank } from './tank.js';
import { SpawnRegistry, SpawnContext } from '../spawn.js';
import { Entity } from '../entity.js';

export function SP_monster_tank_commander(self: Entity, context: SpawnContext): void {
  // Tank Commander is essentially a Tank with a different skin (or sound, though often just skin in Q2)
  // and potentially different stats or behavior (more aggressive).
  // For base Quake 2, the behavior is largely identical to the Tank,
  // but it's a "Commander" so it might trigger some scripted events in maps.
  // We can reuse SP_monster_tank and override what's needed.

  SP_monster_tank(self, context);

  self.classname = 'monster_tank_commander';
  self.skin = 2; // Tank Commander uses a different skin usually
  self.health = 1000; // Tougher
  self.max_health = 1000;
}

export function registerTankCommanderSpawns(registry: SpawnRegistry): void {
  registry.register('monster_tank_commander', SP_monster_tank_commander);
}
