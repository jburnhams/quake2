import { Entity, ServerFlags, Solid } from './entity.js';
import type { SpawnRegistry } from './spawn.js';

const ATTN_NONE = 0;
const ATTN_NORM = 1;
const ATTN_IDLE = 2;
const ATTN_STATIC = 3;

const SPEAKER_SPAWNFLAGS = {
  LoopedOn: 1 << 0,
  LoopedOff: 1 << 1,
  Reliable: 1 << 2,
} as const;

function useChangeLevel(self: Entity) {
  if (self.map) {
    // Simplified, actual implementation would call engine API
  }
}

function targetSpeakerUse(self: Entity, other: Entity | null, activator: Entity | null, context: any) {
  let noiseIndex = self.noise_index;
  const channel = 2; // CHAN_VOICE or similar
  // Note: we don't have direct access to 'sound' via EntitySystem context in 'use'
  // But wait, the context is usually passed to spawn, not use.
  // We need to store 'sound' function or access it via global/closure if possible.
  // Actually, EntitySystem instance is not passed to use callback by default type definition in entity.ts
  // Wait, EntitySystem.useTargets calls use(target, entity, activator).
  // It does NOT pass context.

  // However, targets.ts spawn functions have access to context.
  // We can capture it in closure.

  const entities = context.entities;

  if (self.spawnflags & 3) { // Looped
    if (self.spawnflags & SPEAKER_SPAWNFLAGS.LoopedOn) {
      self.spawnflags &= ~SPEAKER_SPAWNFLAGS.LoopedOn;
      self.spawnflags |= SPEAKER_SPAWNFLAGS.LoopedOff;
      // Stop sound?
      // Q2 sets s.sound = 0
      self.sounds = 0;
    } else {
      self.spawnflags &= ~SPEAKER_SPAWNFLAGS.LoopedOff;
      self.spawnflags |= SPEAKER_SPAWNFLAGS.LoopedOn;
      self.sounds = noiseIndex;
    }
  } else { // Normal one-shot
    if (noiseIndex) {
        // We need the sound name string, but noise_index is an int.
        // We probably stored the string in self.message?
        // Or we rely on self.message being the sound name.
        if (self.message) {
            entities.sound(self, channel, self.message, self.volume, self.attenuation, 0);
        }
    }
  }
}

export function registerTargetSpawns(registry: SpawnRegistry) {
  registry.register('target_temp_entity', () => {
    // Implementation deferred pending effects system (Section 2)
  });

  registry.register('target_speaker', (entity, context) => {
    const noise = context.keyValues.noise;
    if (noise) {
        entity.message = noise;
        // In a real engine we would precache and get an index.
        // For now we just store the string in message.
        // And maybe a mock index.
        entity.noise_index = 1;
    }

    const attenuation = context.keyValues.attenuation;
    if (attenuation) {
        entity.attenuation = Number.parseFloat(attenuation);
    } else {
        entity.attenuation = ATTN_NORM;
    }

    if (context.keyValues.volume) {
        entity.volume = Number.parseFloat(context.keyValues.volume);
    } else {
        entity.volume = 1.0;
    }

    if (entity.spawnflags & SPEAKER_SPAWNFLAGS.LoopedOn) {
        entity.sounds = entity.noise_index;
    }

    entity.use = (self, other, activator) => targetSpeakerUse(self, other, activator ?? null, context);

    // Must be non-solid to not block
    entity.solid = Solid.Not;
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
    if (entity.count === 0) {
      entity.count = 1;
    }
    entity.use = (self) => {
      self.count--;
      if (self.count === 0) {
        entities.useTargets(self, self.activator ?? null);
      }
    };
  });

  registry.register('target_goal', (entity, { entities }) => {
    entity.use = (self) => {
      entities.useTargets(self, self.activator ?? null);
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
