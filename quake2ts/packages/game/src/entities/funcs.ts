import { distance, vec3Equals, normalizeVec3, subtractVec3, scaleVec3, addVec3 } from '@quake2ts/shared';
import { Entity, MoveType, Solid } from './entity.js';
import type { SpawnContext, SpawnFunction, SpawnRegistry } from './spawn.js';
import { EntitySystem } from './system.js';
import { setMovedir } from './utils.js';

// ... (imports and existing func_door/train/plat/rotating code) ...

export enum DoorState {
  Open,
  Opening,
  Closed,
  Closing,
}

// ... (door code) ...
function door_blocked(self: Entity, other: Entity | null) {
  if (other && other.takedamage) {
    const damage = self.dmg || 2;
    other.health -= damage;
  }
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
  door.velocity = scaleVec3(normalizeVec3(subtractVec3(door.pos1, door.origin)), speed);

  if (move <= door.speed * 0.1) {
       door.velocity = scaleVec3(subtractVec3(door.pos1, door.origin), 10);
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
  door.velocity = scaleVec3(normalizeVec3(subtractVec3(door.pos2, door.origin)), door.speed);

  if (move <= door.speed * 0.1) {
       door.velocity = scaleVec3(subtractVec3(door.pos2, door.origin), 10);
  }
  context?.scheduleThink(door, context.timeSeconds + 0.1);
}

const func_door: SpawnFunction = (entity, context) => {
  entity.movedir = setMovedir(entity.angles);
  if (!entity.speed) entity.speed = 100;
  if (!entity.wait) entity.wait = 3;
  if (!entity.lip) entity.lip = 8;
  if (!entity.dmg) entity.dmg = 2;
  if (!entity.health) entity.health = 0;
  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;
  entity.blocked = door_blocked;
  entity.state = DoorState.Closed;
  entity.pos1 = { ...entity.origin };
  const move = entity.movedir.x * (Math.abs(entity.maxs.x - entity.mins.x) - entity.lip) +
               entity.movedir.y * (Math.abs(entity.maxs.y - entity.mins.y) - entity.lip) +
               entity.movedir.z * (Math.abs(entity.maxs.z - entity.mins.z) - entity.lip);
  entity.pos2 = addVec3(entity.pos1, scaleVec3(entity.movedir, move));

  if (entity.spawnflags & 1) { // START_OPEN
      entity.origin = { ...entity.pos2 };
      entity.state = DoorState.Open;
  }

  // Handle shootable doors
  if (entity.health > 0) {
      entity.takedamage = true;
      entity.max_health = entity.health;
      entity.die = (self, inflictor, attacker, damage) => {
          self.health = self.max_health;
          self.takedamage = false;
          self.use?.(self, attacker, attacker);
      };
  }

  entity.use = (self, other, activator) => {
    if (entity.spawnflags & 32) { // TOGGLE
         if (self.state === DoorState.Closed) {
             self.state = DoorState.Opening;
             self.think = door_go_up;
             context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);
         } else if (self.state === DoorState.Open) {
             self.state = DoorState.Closing;
             self.think = door_go_down;
             context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);
         }
         return;
    }

    if (self.state !== DoorState.Closed) return;
    self.state = DoorState.Opening;
    self.think = door_go_up;
    context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);

    // Sound selection
    let soundName = 'doors/dr1_strt.wav';
    if (entity.sounds) {
        // Basic mapping for now, can be expanded
        switch (entity.sounds) {
            case 1: soundName = 'doors/dr1_strt.wav'; break;
            case 2: soundName = 'doors/dr2_strt.wav'; break;
            case 3: soundName = 'doors/dr3_strt.wav'; break;
            case 4: soundName = 'doors/dr4_strt.wav'; break;
            default: soundName = 'doors/dr1_strt.wav';
        }
    }
    context.entities.sound(self, 0, soundName, 1, 1, 0);
  };

  if (entity.health <= 0 && !entity.targetname) {
      entity.touch = (self, other) => {
          if (!other || other.classname !== 'player') return;
          self.use?.(self, other, other);
      }
  }
};

const func_button: SpawnFunction = (entity, context) => {
  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;
  entity.use = (self) => {
    context.entities.useTargets(self, self);
    context.entities.sound(self, 0, 'switches/butn2.wav', 1, 1, 0); // Default sound
  };
};

// ... (func_train code) ...
const TRAIN_START_ON = 1;
const TRAIN_TOGGLE = 2;
const TRAIN_BLOCK_STOPS = 4;

function train_blocked(self: Entity, other: Entity | null) {
  if (other && other.takedamage) {
    other.health -= self.dmg || 0;
  }
  if (!(self.spawnflags & TRAIN_BLOCK_STOPS)) {
    return;
  }
  self.velocity = { x: 0, y: 0, z: 0 };
  self.nextthink = 0;
}

function train_wait(self: Entity, context: EntitySystem) {
  if (self.target_ent && self.target_ent.pathtarget) {
    context.useTargets(self.target_ent, self);
  }
  if (self.target_ent && self.target_ent.target) {
    const next = context.pickTarget(self.target_ent.target);
    if (!next) return;
    self.target_ent = next;
    const dist = distance(self.origin, next.origin);
    const speed = self.speed || 100;
    const time = dist / speed;
    const dir = normalizeVec3(subtractVec3(next.origin, self.origin));
    self.velocity = scaleVec3(dir, speed);
    self.think = train_next;
    context.scheduleThink(self, context.timeSeconds + time);
  }
}

function train_next(self: Entity, context: EntitySystem) {
  self.velocity = { x: 0, y: 0, z: 0 };
  if (self.target_ent) {
    self.origin = { ...self.target_ent.origin };
  }
  const wait = self.wait || 0;
  if (wait > 0) {
    self.think = train_wait;
    context.scheduleThink(self, context.timeSeconds + wait);
  } else {
    train_wait(self, context);
  }
}

function train_find(self: Entity, context: EntitySystem) {
  const target = context.pickTarget(self.target);
  if (!target) return;
  self.target_ent = target;
  self.origin = { ...target.origin };
  if (self.spawnflags & TRAIN_START_ON) {
    train_wait(self, context);
  } else {
    self.use = (ent) => {
      if (ent.velocity.x !== 0 || ent.velocity.y !== 0 || ent.velocity.z !== 0) return;
      train_wait(ent, context);
    };
  }
}

const func_train: SpawnFunction = (entity, context) => {
  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;
  entity.blocked = train_blocked;
  if (!entity.speed) entity.speed = 100;
  if (!entity.dmg) entity.dmg = 2;
  entity.think = (self) => train_find(self, context.entities);
  context.entities.scheduleThink(entity, context.entities.timeSeconds + 0.1);
};

// ... (func_plat code) ...
enum PlatState {
    Up,
    Down,
    GoingUp,
    GoingDown,
}

function plat_go_down(ent: Entity, context: EntitySystem) {
    if (vec3Equals(ent.origin, ent.pos2)) {
        ent.state = PlatState.Down;
        ent.velocity = { x: 0, y: 0, z: 0 };
        return;
    }
    const move = distance(ent.origin, ent.pos2);
    ent.velocity = scaleVec3(normalizeVec3(subtractVec3(ent.pos2, ent.origin)), ent.speed);
    if (move <= ent.speed * 0.1) {
         ent.velocity = scaleVec3(subtractVec3(ent.pos2, ent.origin), 10);
    }
    context.scheduleThink(ent, context.timeSeconds + 0.1);
}

function plat_go_up(ent: Entity, context: EntitySystem) {
    if (vec3Equals(ent.origin, ent.pos1)) {
        ent.state = PlatState.Up;
        ent.velocity = { x: 0, y: 0, z: 0 };
        if (!(ent.spawnflags & 1)) {
             ent.think = plat_wait_top;
             context.scheduleThink(ent, context.timeSeconds + ent.wait);
        }
        return;
    }
    const move = distance(ent.origin, ent.pos1);
    ent.velocity = scaleVec3(normalizeVec3(subtractVec3(ent.pos1, ent.origin)), ent.speed);
    if (move <= ent.speed * 0.1) {
        ent.velocity = scaleVec3(subtractVec3(ent.pos1, ent.origin), 10);
    }
    context.scheduleThink(ent, context.timeSeconds + 0.1);
}

function plat_wait_top(ent: Entity, context: EntitySystem) {
    ent.state = PlatState.GoingDown;
    ent.think = plat_go_down;
    plat_go_down(ent, context);
}

const func_plat: SpawnFunction = (entity, context) => {
    entity.movedir = setMovedir(entity.angles);
    if (!entity.speed) entity.speed = 200;
    if (!entity.accel) entity.accel = 500;
    if (!entity.decel) entity.decel = 500;
    if (!entity.wait) entity.wait = 3;
    if (!entity.lip) entity.lip = 8;
    if (!entity.height) entity.height = (entity.size.z - entity.lip);

    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;

    entity.pos1 = { ...entity.origin };

    // Fix read-only assignment by creating a new object
    entity.pos2 = {
      x: entity.origin.x,
      y: entity.origin.y,
      z: entity.origin.z - entity.height
    };

    entity.origin = { ...entity.pos2 };
    entity.state = PlatState.Down;

    entity.blocked = (self, other) => {
        if (other && other.takedamage) {
             other.health -= self.dmg || 2;
        }
        if (self.state === PlatState.GoingUp) {
             self.state = PlatState.GoingDown;
             self.think = (e) => plat_go_down(e, context.entities);
        }
        else if (self.state === PlatState.GoingDown) {
             self.state = PlatState.GoingUp;
             self.think = (e) => plat_go_up(e, context.entities);
        }
    };

    entity.use = (self) => {
        if (self.state === PlatState.Down) {
             self.state = PlatState.GoingUp;
             self.think = (e) => plat_go_up(e, context.entities);
             context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);
        }
    };

    const trigger = context.entities.spawn();
    trigger.classname = "plat_trigger";
    trigger.movetype = MoveType.None;
    trigger.solid = Solid.Trigger;
    trigger.mins = { x: entity.mins.x + 25, y: entity.mins.y + 25, z: entity.maxs.z };
    trigger.maxs = { x: entity.maxs.x - 25, y: entity.maxs.y - 25, z: entity.maxs.z + 8 };
    trigger.touch = (t, other) => {
        if (entity.state === PlatState.Down) {
            entity.use?.(entity, other, other);
        }
    };
};

// ... (func_rotating code) ...
const func_rotating: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;

    if (!entity.speed) {
        entity.speed = 100;
    }

    if (entity.spawnflags & 4) {
        entity.avelocity = { x: entity.speed, y: 0, z: 0 };
    } else if (entity.spawnflags & 8) {
        entity.avelocity = { x: 0, y: entity.speed, z: 0 };
    } else {
        entity.avelocity = { x: 0, y: 0, z: entity.speed };
    }

    if (entity.dmg) {
        entity.blocked = (self, other) => {
            if (other && other.takedamage) {
                other.health -= self.dmg;
            }
        };
    }
};

// ============================================================================
// FUNC MISC (Conveyor, Water, Explosive, Killbox)
// ============================================================================

const func_conveyor: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Bsp;

    if (!entity.speed) entity.speed = 100;
    entity.movetype = MoveType.None;
};

const func_water: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;
};

const func_explosive: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;

    if (!entity.health) entity.health = 100;
    if (!entity.dmg) entity.dmg = 120;

    entity.takedamage = true;

    entity.die = (self, inflictor, attacker, damage) => {
        context.entities.free(self);
    };
};

const func_killbox: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Not;
    entity.movetype = MoveType.None;

    entity.use = (self) => {
        context.entities.killBox(self);
    };
};

const func_areaportal: SpawnFunction = (entity, context) => {
    entity.use = (self, other, activator) => {
        entity.state = entity.state === DoorState.Open ? DoorState.Closed : DoorState.Open;
        // Real implementation would update PVS visibility
    };
}

export function registerFuncSpawns(registry: SpawnRegistry) {
  registry.register('func_door', func_door);
  registry.register('func_button', func_button);
  registry.register('func_train', func_train);
  registry.register('func_plat', func_plat);
  registry.register('func_rotating', func_rotating);
  registry.register('func_conveyor', func_conveyor);
  registry.register('func_water', func_water);
  registry.register('func_explosive', func_explosive);
  registry.register('func_killbox', func_killbox);
  registry.register('func_areaportal', func_areaportal);
}
