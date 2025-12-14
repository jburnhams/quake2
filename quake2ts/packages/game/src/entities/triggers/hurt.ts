import { Entity, Solid, ServerFlags, type TouchCallback } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { initTrigger } from './common.js';

const HURT_SPAWNFLAGS = {
  StartOff: 1 << 0,
  Toggle: 1 << 1,
  Silent: 1 << 2,
  NoProtection: 1 << 3,
  Slow: 1 << 4,
  NoPlayers: 1 << 5,
  NoMonsters: 1 << 6,
  Clip: 1 << 7,
} as const;

const HURT_INTERVAL = 0.1;

function hurtTouch(self: Entity, other: Entity | null, entities: EntitySystem): void {
  if (!other) {
    return;
  }
  if (!other.takedamage && other.classname !== 'grenade') {
    return;
  }
  if (self.spawnflags & HURT_SPAWNFLAGS.NoMonsters && (other.svflags & ServerFlags.Monster)) {
    return;
  }
  if (self.spawnflags & HURT_SPAWNFLAGS.NoPlayers && (other.svflags & ServerFlags.Player)) {
    return;
  }
  if (self.timestamp > entities.timeSeconds) {
    return;
  }

  self.timestamp = entities.timeSeconds + (self.spawnflags & HURT_SPAWNFLAGS.Slow ? 1 : HURT_INTERVAL);

  const damage = self.dmg || 5;
  other.health -= damage; // TODO: Use T_Damage properly
}

function toggleSolid(self: Entity): void {
  self.solid = self.solid === Solid.Not ? Solid.Trigger : Solid.Not;
}

export function registerTriggerHurt(registry: SpawnRegistry): void {
  registry.register('trigger_hurt', (entity, context) => {
    initTrigger(entity);

    entity.dmg = entity.dmg || 5;
    const touchHandler: TouchCallback = (self, other) => hurtTouch(self, other, context.entities);
    entity.touch = touchHandler;

    if (entity.spawnflags & HURT_SPAWNFLAGS.StartOff) {
      entity.solid = Solid.Not;
      entity.touch = undefined;
    }

    if (entity.spawnflags & HURT_SPAWNFLAGS.Toggle) {
      entity.use = (self) => {
        toggleSolid(self);
        self.touch = self.solid === Solid.Trigger ? touchHandler : undefined;
      };
    }
  });
}
