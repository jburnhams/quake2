import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';
import { EntitySystem } from '../system.js';
import { setMovedir } from '../utils.js';

const SECRET_SPAWNFLAGS = {
  Once: 1 << 0,
} as const;

function triggerSecretTouch(self: Entity, other: Entity | null, entities: EntitySystem): void {
  if (!other || !other.client) {
    return;
  }
  if (self.timestamp > entities.timeSeconds) {
    return;
  }

  self.timestamp = entities.timeSeconds + 1;

  if (!self.message) {
    self.message = 'You found a secret area!';
  }

  if (other.client) {
    entities.engine.centerprintf?.(other, self.message);
    entities.sound(other, 0, 'misc/secret.wav', 1, 1, 0);
    // TODO: update found_secrets in GameExports or LevelState
    // For now we just print message
    // references g_trigger.cpp lines 782-850
  }

  if (self.spawnflags & SECRET_SPAWNFLAGS.Once) {
    entities.free(self);
  }
}

export function registerTriggerSecret(registry: SpawnRegistry): void {
  registry.register('trigger_secret', (entity, context) => {
    entity.movetype = MoveType.None;
    entity.solid = Solid.Trigger;
    entity.svflags |= ServerFlags.NoClient;
    entity.movedir = setMovedir(entity.angles);

    // reset angles
    entity.angles = { x: 0, y: 0, z: 0 };

    if (entity.targetname) {
       entity.solid = Solid.Not;
       entity.use = (self) => {
          self.solid = Solid.Trigger;
          self.use = undefined; // one-shot enable?
       };
    }

    entity.touch = (self, other) => triggerSecretTouch(self, other, context.entities);
  });
}
