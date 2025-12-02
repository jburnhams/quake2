import { Entity, ServerFlags, Solid, MoveType } from './entity.js';
import type { SpawnRegistry } from './spawn.js';
import { TempEntity, ServerCommand, scaleVec3, normalizeVec3, subtractVec3, addVec3, copyVec3, ZERO_VEC3, CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_DEADMONSTER } from '@quake2ts/shared';
import { MulticastType } from '../imports.js';
import { setMovedir } from './utils.js';
import { createBlasterBolt } from './projectiles.js';
import { DamageMod } from '../combat/damageMods.js';
import { T_Damage, Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';

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

// target_laser implementation

const TARGET_LASER_START_ON = 1;
const TARGET_LASER_RED = 2;
const TARGET_LASER_GREEN = 4;
const TARGET_LASER_BLUE = 8;
const TARGET_LASER_YELLOW = 16;
const TARGET_LASER_ORANGE = 32;
const TARGET_LASER_FAT = 64;

function target_laser_think(self: Entity, context: any) {
    let count: number;

    // Use spawnflags high bit 0x80000000 to track state (hitting enemy vs hitting wall)
    if (self.spawnflags & 0x80000000) {
        count = 8;
    } else {
        count = 4;
    }

    if (self.enemy) {
        const last_movedir = { ...self.movedir };
        const size = subtractVec3(self.enemy.maxs, self.enemy.mins);
        const centerOffset = scaleVec3(size, 0.5);
        const enemyCenter = addVec3(self.enemy.mins, centerOffset);

        const dir = subtractVec3(enemyCenter, self.origin);
        self.movedir = normalizeVec3(dir);

        if (Math.abs(self.movedir.x - last_movedir.x) > 0.001 ||
            Math.abs(self.movedir.y - last_movedir.y) > 0.001 ||
            Math.abs(self.movedir.z - last_movedir.z) > 0.001) {
             self.spawnflags |= 0x80000000;
        }
    }

    let ignore: Entity = self;
    let start = { ...self.origin };
    const end = addVec3(start, scaleVec3(self.movedir, 2048));
    let traceResult: any;

    while (true) {
        traceResult = context.entities.trace(start, end, ZERO_VEC3, ZERO_VEC3, ignore, CONTENTS_SOLID | CONTENTS_MONSTER | CONTENTS_DEADMONSTER);

        if (!traceResult.ent) {
            break;
        }

        const trEnt = traceResult.ent;

        // hurt it if we can
        if (trEnt.takedamage && !(trEnt.flags & 0x00000002)) { // FL_IMMUNE_LASER? assuming 2.
             T_Damage(trEnt as unknown as Damageable, self as unknown as Damageable, self.activator as unknown as Damageable, self.movedir, traceResult.endpos, ZERO_VEC3, self.dmg, 1, DamageFlags.ENERGY, DamageMod.TARGET_LASER, context.entities.timeSeconds);
        }

        // if we hit something that's not a monster or player or is immune to lasers, we're done
        if (!(trEnt.svflags & 0x00000001) && !trEnt.client) { // SVF_MONSTER
            if (self.spawnflags & 0x80000000) {
                 self.spawnflags &= ~0x80000000;
                 context.entities.multicast(traceResult.endpos, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.LASER_SPARKS, count, traceResult.endpos, traceResult.plane?.normal || ZERO_VEC3, self.skin);
            }
            break;
        }

        ignore = trEnt;
        start = { ...traceResult.endpos };
    }

    // Update old_origin to endpos for beam rendering
    self.old_origin = { ...traceResult.endpos };

    self.nextthink = context.entities.timeSeconds + 0.1;
}

function target_laser_on(self: Entity, context: any) {
    if (!self.activator) {
        self.activator = self;
    }
    self.spawnflags |= 0x80000001;
    self.svflags &= ~ServerFlags.NoClient;
    target_laser_think(self, context);
}

function target_laser_off(self: Entity) {
    self.spawnflags &= ~1; // Clear START_ON / Active bit
    self.svflags |= ServerFlags.NoClient;
    self.nextthink = 0;
}

function target_laser_use(self: Entity, other: Entity | null, activator: Entity | null, context: any) {
    self.activator = activator;
    if (self.spawnflags & 1) {
        target_laser_off(self);
    } else {
        target_laser_on(self, context);
    }
}

function target_laser_start(self: Entity, context: any) {
    self.movetype = MoveType.None;
    self.solid = Solid.Not;
    self.renderfx |= 0x00000008 | 0x00000040; // RF_BEAM | RF_TRANSLUCENT

    self.modelindex = 1;

    if (self.spawnflags & TARGET_LASER_FAT) {
        self.frame = 16;
    } else {
        self.frame = 4;
    }

    if (self.spawnflags & TARGET_LASER_RED) {
        self.skin = 0xf2f2f0f0;
    } else if (self.spawnflags & TARGET_LASER_GREEN) {
        self.skin = 0xd0d1d2d3;
    } else if (self.spawnflags & TARGET_LASER_BLUE) {
        self.skin = 0xf3f3f1f1;
    } else if (self.spawnflags & TARGET_LASER_YELLOW) {
        self.skin = 0xdcdddedf;
    } else if (self.spawnflags & TARGET_LASER_ORANGE) {
        self.skin = 0xe0e1e2e3;
    }

    if (!self.enemy) {
        if (self.target) {
            let found: Entity | null = null;
            context.entities.forEachEntity((ent: Entity) => {
                if (ent.targetname === self.target) {
                    found = ent;
                }
            });

            if (found) {
                self.enemy = found;
            } else {
                context.warn(`${self.classname} at ${self.origin}: ${self.target} is a bad target`);
                 self.movedir = setMovedir(self.angles);
            }
        } else {
            self.movedir = setMovedir(self.angles);
        }
    }

    self.use = (s, o, a) => target_laser_use(s, o, a || null, context);
    self.think = (s) => target_laser_think(s, context);

    if (!self.dmg) {
        self.dmg = 1;
    }

    self.absmin = addVec3(self.origin, { x: -8, y: -8, z: -8 });
    self.absmax = addVec3(self.origin, { x: 8, y: 8, z: 8 });
    context.entities.linkentity(self);

    if (self.spawnflags & TARGET_LASER_START_ON) {
        target_laser_on(self, context);
    } else {
        target_laser_off(self);
    }
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

  registry.register('target_laser', (entity, context) => {
      entity.think = (self) => target_laser_start(self, context);
      entity.think = (self) => target_laser_start(self, context);
      entity.nextthink = context.entities.timeSeconds + 1;
  });

  registry.register('target_crosslevel_trigger', (entity, context) => {
    entity.svflags |= ServerFlags.NoClient;
    entity.use = (self) => {
        context.entities.crossLevelFlags |= self.spawnflags;
        context.free(self);
    };
  });

  registry.register('target_crosslevel_target', (entity, context) => {
    entity.svflags |= ServerFlags.NoClient;
    if (!entity.delay) {
        entity.delay = 1;
    }
    const SFL_CROSS_TRIGGER_MASK = 0xFFFFFFFF; // Assume full mask for now, TODO: refine if needed
    entity.think = (self) => {
        const flags = self.spawnflags & SFL_CROSS_TRIGGER_MASK;
        if ((context.entities.crossLevelFlags & flags) === flags) {
            context.entities.useTargets(self, self);
            context.free(self);
        }
    };
    context.entities.scheduleThink(entity, context.entities.timeSeconds + entity.delay);
  });

  registry.register('target_crossunit_trigger', (entity, context) => {
    entity.svflags |= ServerFlags.NoClient;
    entity.use = (self) => {
        context.entities.crossUnitFlags |= self.spawnflags;
        context.free(self);
    };
  });

  registry.register('target_crossunit_target', (entity, context) => {
    entity.svflags |= ServerFlags.NoClient;
    if (!entity.delay) {
        entity.delay = 1;
    }
    const SFL_CROSS_TRIGGER_MASK = 0xFFFFFFFF;
    entity.think = (self) => {
        const flags = self.spawnflags & SFL_CROSS_TRIGGER_MASK;
        if ((context.entities.crossUnitFlags & flags) === flags) {
            context.entities.useTargets(self, self);
            context.free(self);
        }
    };
    context.entities.scheduleThink(entity, context.entities.timeSeconds + entity.delay);
  });
}
