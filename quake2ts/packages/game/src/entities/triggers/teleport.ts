import { Entity, MoveType, Solid, ServerFlags } from '../entity.js';
import { EntitySystem } from '../system.js';
import { SpawnRegistry } from '../spawn.js';
import { initTrigger } from './common.js';

const TELEPORT_SPAWNFLAGS = {
  StartOn: 1 << 3,
} as const;

function teleportTouch(
  self: Entity,
  other: Entity | null,
  entities: EntitySystem,
  warn: (message: string) => void,
): void {
  if (!other) {
    return;
  }
  if (self.delay > 0) {
    return;
  }

  const destination = entities.pickTarget(self.target);
  if (!destination) {
    warn('trigger_teleport target not found');
    return;
  }

  const destOrigin = {
    x: destination.origin.x,
    y: destination.origin.y,
    z: destination.origin.z + 10,
  } as const;

  other.origin = { ...destOrigin };
  other.old_origin = { ...destOrigin };
  other.velocity = { x: 0, y: 0, z: 0 };
  other.groundentity = null;
  other.angles = { ...destination.angles };

  // TODO: Teleport effects
  entities.killBox(other);
}

export function registerTriggerTeleport(registry: SpawnRegistry): void {
  registry.register('trigger_teleport', (entity, context) => {
    if (!entity.wait) {
      entity.wait = 0.2;
    }

    initTrigger(entity);

    if (entity.targetname) {
      entity.use = (self) => {
        self.delay = self.delay > 0 ? 0 : 1;
      };
      if ((entity.spawnflags & TELEPORT_SPAWNFLAGS.StartOn) === 0) {
        entity.delay = 1; // 1 means disabled for logic check above
      }
    }

    entity.touch = (self, other) => teleportTouch(self, other, context.entities, context.warn);
  });
}
