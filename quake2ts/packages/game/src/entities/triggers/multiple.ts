import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { canActivate, initTrigger, TRIGGER_SPAWNFLAGS, triggerEnable, FRAME_TIME_SECONDS } from './common.js';

function multiWait(self: Entity): void {
  self.nextthink = 0;
  self.think = undefined;
}

export function multiTrigger(self: Entity, entities: EntitySystem): void {
  if (self.nextthink > entities.timeSeconds) {
    return;
  }

  // Trigger sounds
  let noise = '';
  switch (self.sounds) {
      case 1: noise = 'misc/secret.wav'; break;
      case 2: noise = 'misc/talk.wav'; break;
      case 3: noise = 'misc/trigger1.wav'; break;
      case 4: noise = 'switches/butn2.wav'; break; // Default or custom
  }
  if (noise) {
      entities.sound(self, 0, noise, 1, 1, 0);
  }

  // Trigger message
  if (self.message && self.activator && self.activator.client) {
      // Send centerprint to activator
      entities.engine.centerprintf?.(self.activator, self.message);
      // Play talk sound if sound 2 was selected, Q2 behavior
      if (self.sounds === 2) {
          entities.sound(self.activator, 0, 'misc/talk.wav', 1, 1, 0);
      }
  }

  entities.useTargets(self, self.activator);

  if (self.wait > 0) {
    self.think = multiWait;
    entities.scheduleThink(self, entities.timeSeconds + self.wait);
  } else {
    self.touch = undefined;
    self.think = (entity) => {
      entities.free(entity);
    };
    entities.scheduleThink(self, entities.timeSeconds + FRAME_TIME_SECONDS);
  }
}

function touchMulti(self: Entity, other: Entity | null, entities: EntitySystem): void {
  if (!other) {
    return;
  }
  if (!canActivate(self, other)) {
    return;
  }

  self.activator = other;
  multiTrigger(self, entities);
}

function useMulti(self: Entity, _other: Entity | null, activator: Entity | null, entities: EntitySystem): void {
  if (self.spawnflags & TRIGGER_SPAWNFLAGS.Toggle) {
    self.solid = self.solid === Solid.Trigger ? Solid.Not : Solid.Trigger;
    return;
  }
  self.activator = activator;
  multiTrigger(self, entities);
}

export function registerTriggerMultiple(registry: SpawnRegistry): void {
  registry.register('trigger_multiple', (entity, context) => {
    initTrigger(entity);

    if (entity.wait === 0) {
      entity.wait = 0.2;
    }

    // Parse CLIP spawnflag
    if (entity.spawnflags & TRIGGER_SPAWNFLAGS.Clip) {
         entity.solid = Solid.Bsp;
    }

    if (entity.spawnflags & TRIGGER_SPAWNFLAGS.Latched) {
      // Latched triggers rely on area queries; fall back to touch behaviour for now.
      entity.solid = Solid.Not;
      entity.movetype = MoveType.None;
      // Latched triggers are manually enabled by other entities
      entity.use = triggerEnable;
    } else if (entity.spawnflags & (TRIGGER_SPAWNFLAGS.Triggered | TRIGGER_SPAWNFLAGS.Toggle)) {
      entity.solid = Solid.Not;
      entity.use = (self, other, activator) => {
        triggerEnable(self);
        useMulti(self, other, activator ?? other, context.entities);
      };
    } else {
      entity.use = (self, other, activator) => useMulti(self, other, activator ?? other, context.entities);
    }

    entity.touch = (self, other) => touchMulti(self, other, context.entities);
  });
}
