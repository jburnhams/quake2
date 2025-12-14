import { Entity } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { multiTrigger } from './multiple.js';

const COUNTER_SPAWNFLAGS = {
  NoMessage: 1 << 0,
} as const;

function counterUse(self: Entity, _other: Entity | null, activator: Entity | null, entities: EntitySystem): void {
  if (self.count === 0) {
    return;
  }

  self.count -= 1;

  if (self.count > 0) {
    if (!(self.spawnflags & COUNTER_SPAWNFLAGS.NoMessage) && activator && activator.client) {
        entities.engine.centerprintf?.(activator, `${self.count} more to go...`);
        entities.sound(activator, 0, 'misc/talk1.wav', 1, 1, 0);
    }
    return;
  }

  if (!(self.spawnflags & COUNTER_SPAWNFLAGS.NoMessage) && activator && activator.client) {
      entities.engine.centerprintf?.(activator, 'Sequence completed!');
      entities.sound(activator, 0, 'misc/talk1.wav', 1, 1, 0);
  }

  self.activator = activator;
  multiTrigger(self, entities);
}

export function registerTriggerCounter(registry: SpawnRegistry): void {
  registry.register('trigger_counter', (entity, context) => {
    entity.wait = -1;
    if (entity.count === 0) {
      entity.count = 2;
    }

    entity.use = (self, other, activator) => counterUse(self, other, activator ?? other, context.entities);
    if (!(entity.spawnflags & COUNTER_SPAWNFLAGS.NoMessage)) {
      entity.message = entity.message ?? 'sequence complete';
    }
  });
}
