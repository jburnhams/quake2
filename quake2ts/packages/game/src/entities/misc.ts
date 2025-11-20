import type { SpawnRegistry } from './spawn.js';
import { MoveType, Solid } from './entity.js';

export function registerMiscSpawns(registry: SpawnRegistry) {
  registry.register('misc_teleporter', (entity) => {
    // Simplified, full implementation in teleporter.c
  });

  registry.register('misc_teleporter_dest', (entity) => {
    // Simplified, just a destination marker
  });

  registry.register('misc_explobox', (entity) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.None;
    // Full implementation in g_misc.c
  });

  registry.register('misc_banner', (entity) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Not;
    // Banners are decorative
  });

  registry.register('misc_deadsoldier', (entity) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Bsp;
    // Decorative
  });

  // Example gib registration, others would follow a similar pattern
  registry.register('misc_gib_arm', (entity) => {
    entity.movetype = MoveType.Toss;
    entity.solid = Solid.Not;
    // Decorative
  });
}
