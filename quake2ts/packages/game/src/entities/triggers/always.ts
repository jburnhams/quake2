import { Entity } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';

export function registerTriggerAlways(registry: SpawnRegistry): void {
  registry.register('trigger_always', (entity, context) => {
    if (entity.delay === 0) {
      entity.delay = 0.2;
    }

    // trigger_always fires its targets shortly after spawning.
    // It doesn't need a use function usually, it just schedules a useTargets.

    // In strict Quake 2, G_UseTargets is called.
    // Here we can use useTargets directly.

    // NOTE: The original triggers.ts implementation called useTargets immediately in spawn?
    // "context.entities.useTargets(entity, entity);"
    // That seems wrong if delay is involved.
    // G_trigger.c says:
    // if (ent->delay < 0.2) ent->delay = 0.2;
    // G_UseTargets(ent, ent);
    // G_UseTargets handles the delay internally if the entity has a delay field.

    context.entities.useTargets(entity, entity);
  });
}
