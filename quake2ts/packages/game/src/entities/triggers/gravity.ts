import { Entity, MoveType, Solid, ServerFlags, type TouchCallback } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { initTrigger } from './common.js';

const GRAVITY_SPAWNFLAGS = {
  Toggle: 1 << 0,
  StartOff: 1 << 1,
  Clip: 1 << 2,
} as const;

function gravityTouch(self: Entity, other: Entity | null): void {
  if (!other) {
    return;
  }

  if (self.spawnflags & GRAVITY_SPAWNFLAGS.Clip) {
    // Clipping requires a trace against world geometry, which is not yet available.
    // Fall back to bounding-box overlap behaviour.
  }

  other.gravity = self.gravity;
}

function toggleSolid(self: Entity): void {
  self.solid = self.solid === Solid.Not ? Solid.Trigger : Solid.Not;
}

export function registerTriggerGravity(registry: SpawnRegistry): void {
  registry.register('trigger_gravity', (entity, context) => {
    const gravityText = context.keyValues.gravity;
    if (!gravityText) {
      context.warn('trigger_gravity requires a gravity value');
      context.free(entity);
      return;
    }

    initTrigger(entity);
    entity.gravity = Number.parseFloat(gravityText) || 0;

    const touchHandler: TouchCallback = (self, other) => gravityTouch(self, other);
    entity.touch = touchHandler;

    if (entity.spawnflags & GRAVITY_SPAWNFLAGS.StartOff) {
      entity.solid = Solid.Not;
      entity.touch = undefined;
    }

    if (entity.spawnflags & GRAVITY_SPAWNFLAGS.Toggle) {
      entity.use = (self) => {
        toggleSolid(self);
        self.touch = self.solid === Solid.Trigger ? touchHandler : undefined;
      };
    }
  });
}
