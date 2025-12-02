import { Entity, ServerFlags, Solid, MoveType, AiFlags } from './entity.js';
import type { SpawnRegistry } from './spawn.js';
import { TempEntity, ServerCommand, scaleVec3, normalizeVec3, subtractVec3, addVec3, copyVec3, ZERO_VEC3, CONTENTS_SOLID, CONTENTS_MONSTER, CONTENTS_PLAYER, CONTENTS_DEADMONSTER, RenderFx, ConfigStringIndex } from '@quake2ts/shared';
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

    // [Paril-KEX] Don't count these monsters so they don't inflate the monster count.
    ent.monsterinfo.aiflags |= AiFlags.DoNotCount;

    spawnFunc(ent, spawnContext);
    context.entities.finalizeSpawn(ent);
    context.entities.linkentity(ent);

    context.entities.killBox(ent); // If something is in the way

    if (self.speed) {
        ent.velocity = { ...self.movedir };
    }

    ent.renderfx |= RenderFx.IrVisible;
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

// target_earthquake implementation

const SPAWNFLAG_EARTHQUAKE_SILENT = 1;
const SPAWNFLAG_EARTHQUAKE_TOGGLE = 2;
const SPAWNFLAG_EARTHQUAKE_ONE_SHOT = 8;

function target_earthquake_think(self: Entity, context: any) {
    if (!(self.spawnflags & SPAWNFLAG_EARTHQUAKE_SILENT)) {
        if (self.last_move_time < context.entities.timeSeconds) {
            context.entities.sound(self, 2, 'world/quake.wav', 1.0, ATTN_NONE, 0);
            self.last_move_time = context.entities.timeSeconds + 0.5;
        }
    }

    context.entities.forEachEntity((ent: Entity) => {
        if (!ent.client) return;

        ent.client.quake_time = context.entities.timeSeconds + 0.2;
    });

    if (context.entities.timeSeconds < self.timestamp) {
        self.nextthink = context.entities.timeSeconds + 0.1;
    }
}

function useTargetEarthquake(self: Entity, other: Entity | null, activator: Entity | null, context: any) {
    if (self.spawnflags & SPAWNFLAG_EARTHQUAKE_ONE_SHOT) {
        context.entities.forEachEntity((ent: Entity) => {
            if (!ent.client) return;

            // Using v_angle or kick_angles for shake effect
            // Original code sets v_dmg_pitch and v_dmg_time
            // Here we can try to approximate or add fields if needed.
            // For now, let's assume client handles quake_time logic for continuous shake,
            // but one_shot might need direct kick application.
            // quake2ts likely handles view kick via kick_angles.
            if (ent.client) {
                if (!ent.client.kick_angles) ent.client.kick_angles = { x: 0, y: 0, z: 0 };
                ent.client.kick_angles = { ...ent.client.kick_angles, x: -self.speed * 0.1 };
                // v_dmg_time logic is usually client-side prediction or handled in p_view.
            }
        });
        return;
    }

    self.timestamp = context.entities.timeSeconds + self.count;

    if (self.spawnflags & SPAWNFLAG_EARTHQUAKE_TOGGLE) {
        if (self.style) {
            self.nextthink = 0;
        } else {
            self.nextthink = context.entities.timeSeconds + 0.1;
        }
        self.style = !self.style ? 1 : 0;
    } else {
        self.nextthink = context.entities.timeSeconds + 0.1;
        self.last_move_time = 0;
    }

    self.activator = activator;
}

// target_lightramp implementation

const SPAWNFLAG_LIGHTRAMP_TOGGLE = 1;

function target_lightramp_think(self: Entity, context: any) {
    // style string construction: 'a' + movedir[0] + ((time - timestamp) / frame_time) * movedir[2]
    // We approximate frame_time as 0.1 since we think every 0.1s, but actually configstrings update instantly?
    // Original uses frame_time_s.

    const timeDelta = context.entities.timeSeconds - self.timestamp;

    // movedir[0] is start char offset ('a' relative)
    // movedir[2] is slope

    const val = self.movedir.x + (timeDelta / 0.1) * self.movedir.z;
    let charCode = Math.floor('a'.charCodeAt(0) + val);

    // Clamp to 'a'-'z' range logic implicitly handled by renderer usually, but let's be safe?
    // Actually, Quake just sends the char.

    const styleStr = String.fromCharCode(charCode);
    // context.entities.configstring(CS_LIGHTS + self.enemy.style, styleStr);
    // We need CS_LIGHTS constant. In Q2 it is 32.
    const CS_LIGHTS = 32;
    if (self.enemy && self.enemy.style !== undefined) {
        context.entities.configstring(CS_LIGHTS + self.enemy.style, styleStr);
    }

    if (timeDelta < self.speed) {
        self.nextthink = context.entities.timeSeconds + 0.1;
    } else if (self.spawnflags & SPAWNFLAG_LIGHTRAMP_TOGGLE) {
        // Toggle direction
        const temp = self.movedir.x;
        self.movedir = { ...self.movedir, x: self.movedir.y, y: temp, z: self.movedir.z * -1 };
    }
}

function useTargetLightramp(self: Entity, other: Entity | null, activator: Entity | null, context: any) {
    if (!self.enemy) {
        let e: Entity | null = null;
        let found = false;

        // This search logic mirrors original which tries to find ANY light matching target
        context.entities.forEachEntity((ent: Entity) => {
            if (ent.targetname === self.target) {
                if (ent.classname === 'light') {
                    self.enemy = ent;
                    found = true;
                } else {
                    context.warn(`${self.classname} target ${self.target} is not a light`);
                }
            }
        });

        if (!found) {
            context.warn(`${self.classname} target ${self.target} not found`);
            return;
        }
    }

    self.timestamp = context.entities.timeSeconds;
    target_lightramp_think(self, context);
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

  registry.register('target_earthquake', (entity, context) => {
      if (!entity.count) entity.count = 5;
      if (!entity.speed) entity.speed = 200;

      entity.svflags |= ServerFlags.NoClient;
      entity.think = (self) => target_earthquake_think(self, context);
      entity.use = (self, other, activator) => useTargetEarthquake(self, other, activator ?? null, context);

      if (!(entity.spawnflags & SPAWNFLAG_EARTHQUAKE_SILENT)) {
          // entity.noise_index = ... // sound loading usually handled elsewhere or here
      }
  });

  registry.register('target_lightramp', (entity, context) => {
      // Message validation "bad ramp" logic skipped for now or assume checked.
      // Message format: "az", "mm", etc. 2 chars.

      entity.svflags |= ServerFlags.NoClient;
      entity.use = (self, other, activator) => useTargetLightramp(self, other, activator ?? null, context);
      entity.think = (self) => target_lightramp_think(self, context);

      if (entity.message && entity.message.length === 2 && entity.speed) {
          const start = entity.message.charCodeAt(0) - 'a'.charCodeAt(0);
          const end = entity.message.charCodeAt(1) - 'a'.charCodeAt(0);
          // movedir usage:
          // [0] = start offset
          // [1] = end offset (not used in think directly, but good for storage)
          // [2] = slope per second

          // Frames per second is implicitly 10Hz in physics but configstrings are generic.
          // slope = (end - start) / (speed / frame_time) ?
          // Re-reading original:
          // self->movedir[2] = (self->movedir[1] - self->movedir[0]) / (self->speed / gi.frame_time_s);
          // frame_time_s is 0.1 usually.

          const slope = (end - start) / (entity.speed / 0.1);
          entity.movedir = { x: start, y: end, z: slope };
      }
  });

  registry.register('target_music', (entity, { entities, keyValues }) => {
      entity.sounds = keyValues.sounds ? parseInt(keyValues.sounds) : 0;
      entity.use = (self) => {
          entities.configString(ConfigStringIndex.CdTrack, `${self.sounds}`);
      };
  });

  registry.register('target_autosave', (entity, context) => {
    entity.use = (self) => {
      // Mocking g_athena_auto_save_min_time CVar logic
      // In TS we access cvars via context.cvar?
      const saveTimeCvar = context.entities.cvar('g_athena_auto_save_min_time', '60');
      const saveTime = saveTimeCvar ? saveTimeCvar.value : 60;

      if (context.entities.timeSeconds - context.entities.level.next_auto_save > saveTime) {
          context.entities.serverCommand('autosave\n');
          context.entities.level.next_auto_save = context.entities.timeSeconds;
      }
    };
  });

  registry.register('target_healthbar', (entity, { entities, warn, free }) => {
      // Logic for target_healthbar use
      // needs to: pick target, verify it matches spawn_count (health), set in level.health_bar_entities
      entity.use = (self) => {
          const target = entities.pickTarget(self.target);
          if (!target || self.health !== target.spawn_count) {
              if (target) {
                  warn(`${self.classname}: target ${target.classname} changed from what it used to be`);
              } else {
                  warn(`${self.classname}: no target`);
              }
              // Use entities.free to ensure consistency with what context.free might point to or just be safe
              entities.free(self);
              return;
          }

          // In Rerelease code it checks MAX_HEALTH_BARS (4).
          // We need to access level.health_bar_entities.
          const level = entities.level;
          if (!level.health_bar_entities) {
             level.health_bar_entities = [null, null, null, null];
          }

          let found = false;
          for (let i = 0; i < 4; i++) {
              if (!level.health_bar_entities[i]) {
                  self.enemy = target;
                  level.health_bar_entities[i] = self;
                  // CONFIG_HEALTH_BAR_NAME = 55
                  entities.configString(55, self.message || "");
                  found = true;
                  break;
              }
          }

          if (!found) {
              warn(`${self.classname}: too many health bars`);
              entities.free(self);
          }
      };

      // Think to check validity periodically
      entity.think = (self) => {
          // Check if target still valid
          // Logic simplified for TS port as pointer validation is different
          // We just check if self.enemy is still good if we assigned it?
          // Rerelease code re-picks target every frame in think check_target_healthbar?
          // Actually "check_target_healthbar" does G_PickTarget.

          const target = entities.pickTarget(self.target);
          if (!target || !(target.svflags & ServerFlags.Monster)) {
               if (target) {
                   warn(`${self.classname}: target ${target.classname} does not appear to be a monster`);
               }
               entities.free(self);
               return;
          }

          self.health = target.spawn_count; // sync spawn count?
          self.nextthink = entities.timeSeconds + 0.1;
      };

      // Delay think start like Rerelease
      entity.nextthink = entities.timeSeconds + 0.1;
  });
}
