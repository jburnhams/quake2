import { distance, vec3Equals } from '@quake2ts/shared';
import { Entity, MoveType, Solid } from './entity.js';
import type { SpawnContext, SpawnFunction, SpawnRegistry } from './spawn.js';
import { EntitySystem } from './system.js';
import { setMovedir } from './utils.js';

export enum DoorState {
  Open,
  Opening,
  Closed,
  Closing,
}

function door_blocked(self: Entity, other: Entity | null) {
  // If blocked, damage the other entity
  if (other && other.takedamage) {
    const damage = self.dmg || 2;
    other.health -= damage;
    // In a real implementation we'd check if other died, play sound, etc.
  }

  // If the blocker is still there (simplification), reverse direction
  // For now, if we are opening, we close. If closing, we open.
  if (self.state === DoorState.Opening) {
    self.state = DoorState.Closing;
    self.think = door_go_down;
  } else if (self.state === DoorState.Closing) {
    self.state = DoorState.Opening;
    self.think = door_go_up;
  }
}

function door_go_down(door: Entity, context: EntitySystem) {
  if (vec3Equals(door.origin, door.pos1)) {
    door.state = DoorState.Closed;
    door.velocity = { x: 0, y: 0, z: 0 };
    return;
  }

  const move = distance(door.origin, door.pos1);
  const speed = Math.min(door.speed, move);

  // Need to handle undershoot/overshoot carefully in a real engine
  // Simplified: set velocity to reach target in 0.1s or cap at max speed
  // But standard Q2 movement is velocity-based constant speed.

  // If we are very close, snap?
  // For now, just set velocity.

  door.velocity = {
    x: (door.pos1.x - door.origin.x) / distance(door.pos1, door.origin) * door.speed,
    y: (door.pos1.y - door.origin.y) / distance(door.pos1, door.origin) * door.speed,
    z: (door.pos1.z - door.origin.z) / distance(door.pos1, door.origin) * door.speed,
  };

  // Re-check distance to stop next frame if close enough
  // For 0.1s think interval:
  if (move <= door.speed * 0.1) {
       // We will reach or overshoot in next frame.
       // We should snap in runPush or handle it here by setting nextthink shorter?
       // For now, we rely on the loop checking position again.
       // Ideally we should set velocity to exactly reach in 0.1s if close.
       door.velocity = {
          x: (door.pos1.x - door.origin.x) / 0.1,
          y: (door.pos1.y - door.origin.y) / 0.1,
          z: (door.pos1.z - door.origin.z) / 0.1,
       };
  }

  context?.scheduleThink(door, context.timeSeconds + 0.1);
}

function door_go_up(door: Entity, context: EntitySystem) {
  if (vec3Equals(door.origin, door.pos2)) {
    door.state = DoorState.Open;
    door.velocity = { x: 0, y: 0, z: 0 };
    context?.scheduleThink(door, context.timeSeconds + door.wait);
    door.think = door_go_down;
    return;
  }

  const move = distance(door.origin, door.pos2);

  door.velocity = {
    x: (door.pos2.x - door.origin.x) / distance(door.pos2, door.origin) * door.speed,
    y: (door.pos2.y - door.origin.y) / distance(door.pos2, door.origin) * door.speed,
    z: (door.pos2.z - door.origin.z) / distance(door.pos2, door.origin) * door.speed,
  };

  if (move <= door.speed * 0.1) {
       door.velocity = {
          x: (door.pos2.x - door.origin.x) / 0.1,
          y: (door.pos2.y - door.origin.y) / 0.1,
          z: (door.pos2.z - door.origin.z) / 0.1,
       };
  }

  context?.scheduleThink(door, context.timeSeconds + 0.1);
}

const func_door: SpawnFunction = (entity, context) => {
  entity.movedir = setMovedir(entity.angles);

  if (!entity.speed) {
    entity.speed = 100;
  }
  if (!entity.wait) {
    entity.wait = 3;
  }
  if (!entity.lip) {
    entity.lip = 8;
  }
  if (!entity.dmg) {
    entity.dmg = 2;
  }
  if (!entity.health) {
    entity.health = 0;
  }

  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;
  entity.blocked = door_blocked;

  entity.state = DoorState.Closed;

  entity.pos1 = { ...entity.origin };
  const move = entity.movedir.x * (Math.abs(entity.maxs.x - entity.mins.x) - entity.lip) +
               entity.movedir.y * (Math.abs(entity.maxs.y - entity.mins.y) - entity.lip) +
               entity.movedir.z * (Math.abs(entity.maxs.z - entity.mins.z) - entity.lip);

  entity.pos2 = {
    x: entity.pos1.x + entity.movedir.x * move,
    y: entity.pos1.y + entity.movedir.y * move,
    z: entity.pos1.z + entity.movedir.z * move,
  };

  entity.use = (self) => {
    if (self.state !== DoorState.Closed) return; // Simple debounce

    self.state = DoorState.Opening;
    self.think = door_go_up;
    context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);
  };
};

const func_button: SpawnFunction = (entity, context) => {
  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;
  entity.use = (self) => {
    context.entities.useTargets(self, self);
  };
};

export function registerFuncSpawns(registry: SpawnRegistry) {
  registry.register('func_door', func_door);
  registry.register('func_button', func_button);
}
