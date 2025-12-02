import { Entity, ServerFlags, Solid } from './entity.js';
import type { SpawnRegistry } from './spawn.js';
import { TempEntity, ServerCommand, scaleVec3 } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { setMovedir } from './utils.js';
import { createBlasterBolt } from './projectiles.js';
import { DamageMod } from '../combat/damageMods.js';

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
  const entities = context.entities;
  const type = self.style as TempEntity;

  // Generic target_temp_entity behavior (mirrors g_target.c)
  entities.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, type, self.origin);
}

function useTargetSplash(self: Entity, context: any) {
  const entities = context.entities;
  // TE_SPLASH: count, origin, movedir, color
  entities.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.SPLASH, self.count, self.origin, self.movedir, self.sounds);
}

function useTargetSpawner(self: Entity, other: Entity | null, activator: Entity | null, context: any, registry: SpawnRegistry) {
    if (!self.target) {
        return;
    }

    const spawnFunc = registry.get(self.target);
    if (!spawnFunc) {
        context.warn(`${self.classname} at ${self.origin}: unknown target ${self.target}`);
        return;
    }

    const ent = context.entities.spawn();
    ent.classname = self.target;
    ent.origin = { ...self.origin };
    ent.angles = { ...self.angles };

    ent.flags = self.flags;

    const spawnContext = {
        keyValues: { classname: self.target },
        entities: context.entities,
        warn: context.warn,
        free: context.free
    };

    spawnFunc(ent, spawnContext);
    context.entities.finalizeSpawn(ent);
    context.entities.linkentity(ent);

    context.entities.killBox(ent); // If something is in the way

    if (self.speed) {
        ent.velocity = { ...self.movedir };
    }
}

const SPAWNFLAG_BLASTER_NOTRAIL = 1;
const SPAWNFLAG_BLASTER_NOEFFECTS = 2;

const EF_BLASTER = 0x00000008; // Check q_shared.h if available, or use constant
const EF_HYPERBLASTER = 0x00001000;

function useTargetBlaster(self: Entity, other: Entity | null, activator: Entity | null, context: any) {
    let effect = 0;
    if (self.spawnflags & SPAWNFLAG_BLASTER_NOEFFECTS) {
        effect = 0;
    } else if (self.spawnflags & SPAWNFLAG_BLASTER_NOTRAIL) {
        effect = EF_HYPERBLASTER;
    } else {
        effect = EF_BLASTER;
    }

    // createBlasterBolt(sys, owner, start, dir, damage, speed, mod)
    // Note: createBlasterBolt in projectiles.ts handles creating the entity.
    // We need to pass 'effect' to it? It currently accepts standard params.
    // If createBlasterBolt doesn't support custom effects, we might need to modify the entity after creation.
    // Actually, checking createBlasterBolt implementation...
    // It calls createBlasterBolt(sys, owner, start, dir, damage, speed, DamageMod.BLUEBLASTER);
    // It doesn't seem to take effect or mod as generic params in the simple signature?
    // Wait, createBlasterBolt is overloaded or I should check its definition.
    // I saw: export function createBlasterBolt(sys: EntitySystem, owner: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, mod: DamageMod)
    // Yes it takes mod. But effect?
    // Projectiles usually have effects set based on type.

    const bolt = createBlasterBolt(context.entities, self, self.origin, self.movedir, self.dmg, self.speed, DamageMod.TARGET_BLASTER);
    if (bolt) {
        if (effect) {
            bolt.effects |= effect;
        } else if (self.spawnflags & SPAWNFLAG_BLASTER_NOEFFECTS) {
            bolt.effects = 0; // Clear default effects?
        }
    }

    context.entities.sound(self, 2, 'weapons/laser2.wav', 1, ATTN_NORM, 0);
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

  registry.register('target_explosion', (entity, { entities }) => {
    entity.use = (self) => {
        entities.multicast(self.origin, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.EXPLOSION1, self.origin);
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

  registry.register('target_spawner', (entity, context) => {
      entity.use = (self, other, activator) => useTargetSpawner(self, other, activator ?? null, context, registry);
      entity.svflags |= ServerFlags.NoClient;
      if (entity.speed) {
          entity.movedir = setMovedir(entity.angles);
          entity.movedir = scaleVec3(entity.movedir, entity.speed);
      }
  });

  registry.register('target_blaster', (entity, context) => {
      entity.use = (self, other, activator) => useTargetBlaster(self, other, activator ?? null, context);
      entity.movedir = setMovedir(entity.angles);

      if (!entity.dmg) entity.dmg = 15;
      if (!entity.speed) entity.speed = 1000;

      entity.svflags |= ServerFlags.NoClient;
  });
}
