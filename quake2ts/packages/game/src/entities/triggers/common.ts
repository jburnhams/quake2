import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { isZeroVector, setMovedir } from '../utils.js';
import { angleVectors } from '@quake2ts/shared';

export const TRIGGER_SPAWNFLAGS = {
  Monster: 1 << 0,
  NotPlayer: 1 << 1,
  Triggered: 1 << 2,
  Toggle: 1 << 3,
  Latched: 1 << 4,
  Clip: 1 << 5,
} as const;

export const FRAME_TIME_SECONDS = 1 / 40;

export function initTrigger(entity: Entity): void {
  entity.movetype = MoveType.None;
  entity.solid = Solid.Trigger;
  entity.svflags |= ServerFlags.NoClient;
  entity.movedir = setMovedir(entity.angles);
  entity.angles = { x: 0, y: 0, z: 0 };
}

export function canActivate(trigger: Entity, other: Entity): boolean {
  if (trigger.solid === Solid.Not) {
    return false;
  }
  if (other.svflags & ServerFlags.Player) {
    if (trigger.spawnflags & TRIGGER_SPAWNFLAGS.NotPlayer) {
      return false;
    }
  } else if (other.svflags & ServerFlags.Monster) {
    if ((trigger.spawnflags & TRIGGER_SPAWNFLAGS.Monster) === 0) {
      return false;
    }
  } else {
    return false;
  }

  if (!isZeroVector(trigger.movedir)) {
    const forward = angleVectors(other.angles).forward;
    const dot = forward.x * trigger.movedir.x + forward.y * trigger.movedir.y + forward.z * trigger.movedir.z;
    if (dot < 0) {
      return false;
    }
  }

  return true;
}

export function triggerEnable(self: Entity): void {
  self.solid = Solid.Trigger;
}
