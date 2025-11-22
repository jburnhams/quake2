import type { SpawnRegistry } from './spawn.js';
import { MoveType, Solid } from './entity.js';

export function registerLightSpawns(registry: SpawnRegistry) {
  registry.register('light', (entity) => {
    // Light entities are primarily for the map compiler (rad),
    // but dynamic lights might need these values.
    // We just ensure they don't block anything.
    entity.movetype = MoveType.None;
    entity.solid = Solid.Not;

    // If 'light' key is set, it's intensity.
    // style, color are also used.
  });

  registry.register('light_mine1', (entity) => {
      entity.movetype = MoveType.None;
      entity.solid = Solid.Not;
  });

  registry.register('light_mine2', (entity) => {
      entity.movetype = MoveType.None;
      entity.solid = Solid.Not;
  });
}
