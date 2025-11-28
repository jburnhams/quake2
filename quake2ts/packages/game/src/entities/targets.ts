import { Entity, ServerFlags, Solid } from './entity.js';
import type { SpawnRegistry } from './spawn.js';
import { TempEntity, ServerCommand } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { setMovedir } from './utils.js';

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
  const entities = context.entities;

  if (self.spawnflags & 3) { // Looped
    if (self.spawnflags & SPEAKER_SPAWNFLAGS.LoopedOn) {
      self.spawnflags &= ~SPEAKER_SPAWNFLAGS.LoopedOn;
      self.spawnflags |= SPEAKER_SPAWNFLAGS.LoopedOff;
      self.sounds = 0;
    } else {
      self.spawnflags &= ~SPEAKER_SPAWNFLAGS.LoopedOff;
      self.spawnflags |= SPEAKER_SPAWNFLAGS.LoopedOn;
      self.sounds = noiseIndex;
    }
  } else { // Normal one-shot
    if (noiseIndex) {
        if (self.message) {
            entities.sound(self, channel, self.message, self.volume, self.attenuation, 0);
        }
    }
  }
}

function useTargetTempEntity(self: Entity, context: any) {
  const imports = context.imports;
  const type = self.style as TempEntity;

  // Generic target_temp_entity behavior (mirrors g_target.c)
  imports.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, type, self.origin);
}

function useTargetSplash(self: Entity, context: any) {
  const imports = context.imports;
  // TE_SPLASH: count, origin, movedir, color
  imports.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.SPLASH, self.count, self.origin, self.movedir, self.sounds);
}

export function registerTargetSpawns(registry: SpawnRegistry) {
  registry.register('target_temp_entity', (entity, context) => {
    entity.style = context.keyValues.style ? parseInt(context.keyValues.style) : 0;
    entity.use = (self) => useTargetTempEntity(self, context);
    entity.svflags |= ServerFlags.NoClient;
  });

  registry.register('target_speaker', (entity, context) => {
    const noise = context.keyValues.noise;
    if (noise) {
        entity.message = noise;
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
    entity.solid = Solid.Not;
  });

  registry.register('target_explosion', (entity, { imports }) => {
    entity.use = (self) => {
        imports.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.EXPLOSION1, self.origin);
    };
    entity.svflags |= ServerFlags.NoClient;
  });

  registry.register('target_splash', (entity, context) => {
    entity.count = context.keyValues.count ? parseInt(context.keyValues.count) : 0;
    entity.sounds = context.keyValues.sounds ? parseInt(context.keyValues.sounds) : 0;
    entity.movedir = setMovedir(entity.angles);
    entity.use = (self) => useTargetSplash(self, context);
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
