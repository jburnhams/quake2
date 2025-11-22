import type { SpawnRegistry } from './spawn.js';
import { Entity, ServerFlags, Solid } from './entity.js';

function pathCornerTouch(self: Entity, other: Entity | null) {
  if (other !== self.owner) {
    return;
  }
  // In Q2, path_corner touch logic is often handled by the train/monster itself,
  // but we can store state here if needed.
  // The main logic is in the train/monster thinking "am I close enough?".
}

export function registerPathSpawns(registry: SpawnRegistry) {
  registry.register('path_corner', (entity) => {
    // path_corner is a target point.
    // It doesn't need physics usually, but might for debugging.
    // Q2 sets it to solid trigger sometimes for debugging or just ignores solid.
    entity.solid = Solid.Not;
    entity.touch = pathCornerTouch;
  });
}
