import { Entity, MoveType, Solid, type TouchCallback } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { initTrigger } from './common.js';

const PUSH_SPAWNFLAGS = {
  Once: 1 << 0,
  Plus: 1 << 1,
  Silent: 1 << 2,
  StartOff: 1 << 3,
  Clip: 1 << 4,
} as const;

const THINK_INTERVAL = 0.1;

function triggerPushTouch(self: Entity, other: Entity | null, entities: EntitySystem): void {
  if (!other) {
    return;
  }

  if (other.classname === 'grenade' || other.health > 0) {
    const scale = (self.speed || 1000) * 10;
    other.velocity = {
      x: self.movedir.x * scale,
      y: self.movedir.y * scale,
      z: self.movedir.z * scale,
    };

    // Play wind sound if not silent
    if (!(self.spawnflags & PUSH_SPAWNFLAGS.Silent)) {
         // Debounce sound
         if (!other.fly_sound_debounce_time || other.fly_sound_debounce_time < entities.timeSeconds) {
             other.fly_sound_debounce_time = entities.timeSeconds + 1.5;
             entities.sound(other, 0, 'misc/windfly.wav', 1, 1, 0);
         }
    }
  }

  if (self.spawnflags & PUSH_SPAWNFLAGS.Once) {
    entities.free(self);
  }
}

function toggleSolid(self: Entity): void {
  self.solid = self.solid === Solid.Not ? Solid.Trigger : Solid.Not;
}

function triggerPushInactive(self: Entity, entities: EntitySystem, touchHandler: TouchCallback): void {
  if (self.delay > entities.timeSeconds) {
    entities.scheduleThink(self, entities.timeSeconds + THINK_INTERVAL);
    return;
  }

  self.touch = touchHandler;
  self.think = (entity) => triggerPushActive(entity, entities, touchHandler);
  self.delay = entities.timeSeconds + self.wait;
  entities.scheduleThink(self, entities.timeSeconds + THINK_INTERVAL);
}

function triggerPushActive(self: Entity, entities: EntitySystem, touchHandler: TouchCallback): void {
  if (self.delay > entities.timeSeconds) {
    entities.scheduleThink(self, entities.timeSeconds + THINK_INTERVAL);
    return;
  }

  self.touch = undefined;
  self.think = (entity) => triggerPushInactive(entity, entities, touchHandler);
  self.delay = entities.timeSeconds + self.wait;
  entities.scheduleThink(self, entities.timeSeconds + THINK_INTERVAL);
}

export function registerTriggerPush(registry: SpawnRegistry): void {
  registry.register('trigger_push', (entity, context) => {
    initTrigger(entity);

    const touchHandler: TouchCallback = (self, other) => triggerPushTouch(self, other, context.entities);
    entity.touch = touchHandler;

    if (!entity.speed) {
      entity.speed = 1000;
    }

    if (entity.spawnflags & PUSH_SPAWNFLAGS.Plus) {
      if (!entity.wait) {
        entity.wait = 10;
      }
      entity.delay = context.entities.timeSeconds + entity.wait;
      entity.think = (self) => triggerPushActive(self, context.entities, touchHandler);
      context.entities.scheduleThink(entity, context.entities.timeSeconds + THINK_INTERVAL);
    }

    if (entity.targetname) {
      entity.use = (self) => {
        toggleSolid(self);
        self.touch = self.solid === Solid.Trigger ? touchHandler : undefined;
      };
      if (entity.spawnflags & PUSH_SPAWNFLAGS.StartOff) {
        entity.solid = Solid.Not;
        entity.touch = undefined;
      }
    } else if (entity.spawnflags & PUSH_SPAWNFLAGS.StartOff) {
      context.warn('trigger_push is START_OFF but not targeted.');
      entity.touch = undefined;
      entity.solid = Solid.Bsp;
      entity.movetype = MoveType.Push;
    }
  });
}
