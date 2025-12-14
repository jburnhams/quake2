import { Entity } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';

const RELAY_SPAWNFLAGS = {
  NoSound: 1 << 0,
} as const;

export function registerTriggerRelay(registry: SpawnRegistry): void {
  registry.register('trigger_relay', (entity, context) => {
    if (entity.spawnflags & RELAY_SPAWNFLAGS.NoSound) {
      entity.noise_index = -1;
    }

    entity.use = (self, _other, activator) => {
      if (!(self.spawnflags & RELAY_SPAWNFLAGS.NoSound)) {
          context.entities.sound(self, 0, 'misc/trigger1.wav', 1, 1, 0);
      }
      if (self.message && activator && activator.client) {
           context.entities.engine.centerprintf?.(activator, self.message);
      }
      context.entities.useTargets(self, activator ?? self);
    };
  });
}
