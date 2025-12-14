import { Entity } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';

function triggerKeyUse(self: Entity, activator: Entity | null, entities: EntitySystem, warn: (message: string) => void): void {
  if (!self.item || !activator) {
    return;
  }

  const available = activator.inventory[self.item] ?? 0;
  if (available <= 0) {
    if (self.timestamp > entities.timeSeconds) {
      return;
    }
    self.timestamp = entities.timeSeconds + 5;
    // In strict Q2, it prints "You need the X".
    // warn() logs to console. We might want centerprint.
    // context.warn is passed here.
    // Let's check existing implementation. It used warn.
    // Ideally should be centerprint if activator is client.
    if (activator.client) {
         entities.engine.centerprintf?.(activator, `You need the ${self.item}`); // TODO: Proper item name lookup
         entities.sound(activator, 0, 'misc/keytry.wav', 1, 1, 0);
    }
    return;
  }

  activator.inventory[self.item] = available - 1;
  if (activator.inventory[self.item] <= 0) {
    delete activator.inventory[self.item];
  }

  entities.sound(activator, 0, 'misc/keyuse.wav', 1, 1, 0);

  entities.useTargets(self, activator);
  self.use = undefined;
}

export function registerTriggerKey(registry: SpawnRegistry): void {
  registry.register('trigger_key', (entity, context) => {
    const requiredItem = context.keyValues.item;
    if (!requiredItem) {
      context.warn('trigger_key requires an item');
      context.free(entity);
      return;
    }

    entity.item = requiredItem;
    entity.use = (self, other, activator) => triggerKeyUse(self, activator ?? other, context.entities, context.warn);
  });
}
