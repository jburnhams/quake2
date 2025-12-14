import { Entity, MoveType, Solid, ServerFlags, EntityFlags, type TouchCallback } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { initTrigger } from './common.js';

const MONSTERJUMP_SPAWNFLAGS = {
  Toggle: 1 << 0,
  StartOff: 1 << 1,
  Clip: 1 << 2,
} as const;

function monsterJumpTouch(self: Entity, other: Entity | null): void {
  if (!other) {
    return;
  }

  if ((other.flags & (EntityFlags.Fly | EntityFlags.Swim)) !== 0) {
    return;
  }
  if (other.svflags & ServerFlags.DeadMonster) {
    return;
  }
  if ((other.svflags & ServerFlags.Monster) === 0) {
    return;
  }

  other.velocity = {
    x: self.movedir.x * self.speed,
    y: self.movedir.y * self.speed,
    z: other.velocity.z,
  };

  if (!other.groundentity) {
    return;
  }

  other.groundentity = null;
  other.velocity = { x: other.velocity.x, y: other.velocity.y, z: self.movedir.z };
}

function toggleSolid(self: Entity): void {
  self.solid = self.solid === Solid.Not ? Solid.Trigger : Solid.Not;
}

export function registerTriggerMonsterJump(registry: SpawnRegistry): void {
  registry.register('trigger_monsterjump', (entity, context) => {
    const heightText = context.keyValues.height;
    const height = heightText ? Number.parseFloat(heightText) || 0 : 200;
    if (entity.angles.y === 0) {
      entity.angles = { ...entity.angles, y: 360 };
    }
    if (!entity.speed) {
      entity.speed = 200;
    }

    initTrigger(entity);
    entity.movedir = { ...entity.movedir, z: height };
    const touchHandler: TouchCallback = (self, other) => monsterJumpTouch(self, other);
    entity.touch = touchHandler;

    if (entity.spawnflags & MONSTERJUMP_SPAWNFLAGS.StartOff) {
      entity.solid = Solid.Not;
      entity.touch = undefined;
    }

    if (entity.spawnflags & MONSTERJUMP_SPAWNFLAGS.Toggle) {
      entity.use = (self) => {
        toggleSolid(self);
        self.touch = self.solid === Solid.Trigger ? touchHandler : undefined;
      };
    }
  });
}
