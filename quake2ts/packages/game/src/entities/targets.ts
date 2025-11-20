import { Entity, ServerFlags, Solid } from './entity.js';
import type { SpawnRegistry } from './spawn.js';

function useChangeLevel(self: Entity) {
  if (self.map) {
    // Simplified, actual implementation would call engine API
  }
}

export function registerTargetSpawns(registry: SpawnRegistry) {
  registry.register('target_temp_entity', () => {
    // Implementation deferred pending effects system (Section 2)
  });

  registry.register('target_speaker', () => {
    // Implementation deferred pending audio system (Section 7)
  });

  registry.register('target_explosion', (entity) => {
    entity.use = () => { /* Simplified */ };
    entity.svflags |= ServerFlags.NoClient;
  });

  registry.register('target_splash', (entity) => {
    entity.use = () => { /* Simplified */ };
    entity.svflags |= ServerFlags.NoClient;
  });

  registry.register('target_secret', (entity, { entities }) => {
    entity.use = (self) => {
      self.count--;
      if (self.count === 0) {
        entities.useTargets(self, self.activator);
      }
    };
  });

  registry.register('target_goal', (entity, { entities }) => {
    entity.use = (self) => {
      entities.useTargets(self, self.activator);
    };
  });

  registry.register('target_changelevel', (entity, { keyValues, free }) => {
    if (!keyValues.map) {
      free(entity);
      return;
    }
    entity.map = keyValues.map;
    entity.use = useChangeLevel;
    entity.solid = Solid.Trigger; // Make it triggerable
  });
}
