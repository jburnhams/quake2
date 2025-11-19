import { angleVectors } from '@quake2ts/shared';
import { EntityFlags, MoveType, ServerFlags, Solid, type Entity, type TouchCallback } from './entity.js';
import type { SpawnRegistry } from './spawn.js';
import { isZeroVector, setMovedir } from './utils.js';
import type { EntitySystem } from './system.js';

const FRAME_TIME_SECONDS = 1 / 40;
const THINK_INTERVAL = 0.1;
const HURT_INTERVAL = 0.1;

const TRIGGER_SPAWNFLAGS = {
  Monster: 1 << 0,
  NotPlayer: 1 << 1,
  Triggered: 1 << 2,
  Toggle: 1 << 3,
  Latched: 1 << 4,
  Clip: 1 << 5,
} as const;

const RELAY_SPAWNFLAGS = {
  NoSound: 1 << 0,
} as const;

const COUNTER_SPAWNFLAGS = {
  NoMessage: 1 << 0,
} as const;

const PUSH_SPAWNFLAGS = {
  Once: 1 << 0,
  Plus: 1 << 1,
  Silent: 1 << 2,
  StartOff: 1 << 3,
  Clip: 1 << 4,
} as const;

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

const TELEPORT_SPAWNFLAGS = {
  StartOn: 1 << 3,
} as const;

const GRAVITY_SPAWNFLAGS = {
  Toggle: 1 << 0,
  StartOff: 1 << 1,
  Clip: 1 << 2,
} as const;

const MONSTERJUMP_SPAWNFLAGS = {
  Toggle: 1 << 0,
  StartOff: 1 << 1,
  Clip: 1 << 2,
} as const;

function initTrigger(entity: Entity): void {
  entity.movetype = MoveType.None;
  entity.solid = Solid.Trigger;
  entity.svflags |= ServerFlags.NoClient;
  entity.movedir = setMovedir(entity.angles);
  entity.angles = { x: 0, y: 0, z: 0 };
}

function multiWait(self: Entity): void {
  self.nextthink = 0;
  self.think = undefined;
}

function canActivate(trigger: Entity, other: Entity): boolean {
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

function multiTrigger(self: Entity, entities: EntitySystem): void {
  if (self.nextthink > entities.timeSeconds) {
    return;
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

function triggerEnable(self: Entity): void {
  self.solid = Solid.Trigger;
}

function registerTriggerMultiple(registry: SpawnRegistry): void {
  registry.register('trigger_multiple', (entity, context) => {
    initTrigger(entity);

    if (entity.wait === 0) {
      entity.wait = 0.2;
    }

    if (entity.spawnflags & TRIGGER_SPAWNFLAGS.Latched) {
      // Latched triggers rely on area queries; fall back to touch behaviour for now.
    }

    if (entity.spawnflags & (TRIGGER_SPAWNFLAGS.Triggered | TRIGGER_SPAWNFLAGS.Toggle)) {
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

function registerTriggerOnce(registry: SpawnRegistry): void {
  registry.register('trigger_once', (entity, context) => {
    entity.wait = -1;
    registry.get('trigger_multiple')?.(entity, context);
  });
}

function registerTriggerRelay(registry: SpawnRegistry): void {
  registry.register('trigger_relay', (entity, context) => {
    if (entity.spawnflags & RELAY_SPAWNFLAGS.NoSound) {
      entity.noise_index = -1;
    }

    entity.use = (self, _other, activator) => {
      context.entities.useTargets(self, activator ?? self);
    };
  });
}

function registerTriggerAlways(registry: SpawnRegistry): void {
  registry.register('trigger_always', (entity, context) => {
    if (entity.delay === 0) {
      entity.delay = 0.2;
    }

    context.entities.useTargets(entity, entity);
  });
}

function counterUse(self: Entity, _other: Entity | null, activator: Entity | null, entities: EntitySystem): void {
  if (self.count === 0) {
    return;
  }

  self.count -= 1;

  if (self.count > 0) {
    return;
  }

  self.activator = activator;
  multiTrigger(self, entities);
}

function registerTriggerCounter(registry: SpawnRegistry): void {
  registry.register('trigger_counter', (entity, context) => {
    entity.wait = -1;
    if (entity.count === 0) {
      entity.count = 2;
    }

    entity.use = (self, other, activator) => counterUse(self, other, activator ?? other, context.entities);
    if (!(entity.spawnflags & COUNTER_SPAWNFLAGS.NoMessage)) {
      entity.message = entity.message ?? 'sequence complete';
    }
  });
}

function triggerKeyUse(self: Entity, activator: Entity | null, entities: EntitySystem, warn: (message: string) => void): void {
  if (!self.item || !activator) {
    return;
  }

  const available = activator.inventory[self.item] ?? 0;
  if (available <= 0) {
    if (self.timestamp > entities.timeSeconds) {
      return;
    }
    self.timestamp = entities.timeSeconds + 5;
    warn(`Missing required key item: ${self.item}`);
    return;
  }

  activator.inventory[self.item] = available - 1;
  if (activator.inventory[self.item] <= 0) {
    delete activator.inventory[self.item];
  }

  entities.useTargets(self, activator);
  self.use = undefined;
}

function registerTriggerKey(registry: SpawnRegistry): void {
  registry.register('trigger_key', (entity, context) => {
    const requiredItem = context.keyValues.item;
    if (!requiredItem) {
      context.warn('trigger_key requires an item');
      context.free(entity);
      return;
    }

    entity.item = requiredItem;
    entity.use = (self, other, activator) => triggerKeyUse(self, activator ?? other, context.entities, context.warn);
  });
}

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

function registerTriggerPush(registry: SpawnRegistry): void {
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
  other.health -= damage;
}

function registerTriggerHurt(registry: SpawnRegistry): void {
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

  entities.killBox(other);
}

function registerTriggerTeleport(registry: SpawnRegistry): void {
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
        entity.delay = 1;
      }
    }

    entity.touch = (self, other) => teleportTouch(self, other, context.entities, context.warn);
  });
}

function gravityTouch(self: Entity, other: Entity | null): void {
  if (!other) {
    return;
  }

  if (self.spawnflags & GRAVITY_SPAWNFLAGS.Clip) {
    // Clipping requires a trace against world geometry, which is not yet available.
    // Fall back to bounding-box overlap behaviour.
  }

  other.gravity = self.gravity;
}

function registerTriggerGravity(registry: SpawnRegistry): void {
  registry.register('trigger_gravity', (entity, context) => {
    const gravityText = context.keyValues.gravity;
    if (!gravityText) {
      context.warn('trigger_gravity requires a gravity value');
      context.free(entity);
      return;
    }

    initTrigger(entity);
    entity.gravity = Number.parseFloat(gravityText) || 0;

    const touchHandler: TouchCallback = (self, other) => gravityTouch(self, other);
    entity.touch = touchHandler;

    if (entity.spawnflags & GRAVITY_SPAWNFLAGS.StartOff) {
      entity.solid = Solid.Not;
      entity.touch = undefined;
    }

    if (entity.spawnflags & GRAVITY_SPAWNFLAGS.Toggle) {
      entity.use = (self) => {
        toggleSolid(self);
        self.touch = self.solid === Solid.Trigger ? touchHandler : undefined;
      };
    }
  });
}

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

function registerTriggerMonsterJump(registry: SpawnRegistry): void {
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

export function registerTriggerSpawns(registry: SpawnRegistry): void {
  registerTriggerMultiple(registry);
  registerTriggerOnce(registry);
  registerTriggerRelay(registry);
  registerTriggerAlways(registry);
  registerTriggerCounter(registry);
  registerTriggerKey(registry);
  registerTriggerPush(registry);
  registerTriggerHurt(registry);
  registerTriggerTeleport(registry);
  registerTriggerGravity(registry);
  registerTriggerMonsterJump(registry);
}
