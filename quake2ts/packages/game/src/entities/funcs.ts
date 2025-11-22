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

function door_go_down(door: Entity, context: EntitySystem) {
  if (vec3Equals(door.origin, door.pos1)) {
    door.state = DoorState.Closed;
    return;
  }

  const move = distance(door.origin, door.pos1);
  const speed = Math.min(door.speed, move);
  door.velocity = {
    x: -door.movedir.x * speed,
    y: -door.movedir.y * speed,
    z: -door.movedir.z * speed,
  };

  context?.scheduleThink(door, context.timeSeconds + 0.1);
}

function door_go_up(door: Entity, context: EntitySystem) {
  if (vec3Equals(door.origin, door.pos2)) {
    door.state = DoorState.Open;
    context?.scheduleThink(door, context.timeSeconds + door.wait);
    door.think = door_go_down;
    return;
  }

  const move = distance(door.origin, door.pos2);
  const speed = Math.min(door.speed, move);
  door.velocity = {
    x: door.movedir.x * speed,
    y: door.movedir.y * speed,
    z: door.movedir.z * speed,
  };

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
