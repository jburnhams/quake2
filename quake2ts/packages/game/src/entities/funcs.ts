import { angleVectors, distance, lengthVec3, normalizeVec3, scaleVec3, subtractVec3, addVec3, Vec3, dotVec3 } from '@quake2ts/shared';
import { Entity, MoveType, Solid, EntityFlags, ServerFlags } from './entity.js';
import type { SpawnFunction, SpawnRegistry } from './spawn.js';
import { EntitySystem } from './system.js';
import { setMovedir } from './utils.js';
import { T_RadiusDamage, Damageable } from '../combat/damage.js';
import { DamageFlags } from '../combat/damageFlags.js';
import { DamageMod } from '../combat/damageMods.js';
import { throwGibs, GIB_METALLIC, GIB_DEBRIS } from './gibs.js';

// ============================================================================
// MOVEMENT HELPERS
// ============================================================================

function move_calc(ent: Entity, dest: Vec3, context: EntitySystem, done: (ent: Entity, ctx: EntitySystem) => void) {
  const dt = 0.1;
  const vec = subtractVec3(dest, ent.origin);
  const dist = lengthVec3(vec);
  const dir = normalizeVec3(vec);

  const speed = ent.speed || 100;

  // Current speed from velocity (approximate)
  let currentSpeed = lengthVec3(ent.velocity);

  // Accel
  if (ent.accel) {
      currentSpeed += ent.accel * dt;
  } else {
      currentSpeed = speed;
  }

  // Decel
  if (ent.decel) {
      const distToStop = (currentSpeed * currentSpeed) / (2 * ent.decel);
      if (dist <= distToStop) {
          currentSpeed -= ent.decel * dt;
          if (currentSpeed < 10) currentSpeed = 10;
      }
  }

  // Clamp
  if (currentSpeed > speed) currentSpeed = speed;

  const move = currentSpeed * dt;

  if (dist <= move) {
      // Finish this frame
      ent.velocity = scaleVec3(dir, dist / dt); // Reach exactly dest
      ent.think = (e) => {
          e.velocity = {x: 0, y: 0, z: 0};
          e.origin = {...dest};
          context.linkentity(e);
          done(e, context);
      };
      context.scheduleThink(ent, context.timeSeconds + dt);
  } else {
      // Continue
      ent.velocity = scaleVec3(dir, currentSpeed);
      ent.think = (e) => {
          // Update position based on velocity (simulating physics step)
          e.origin = addVec3(e.origin, scaleVec3(e.velocity, dt));
          context.linkentity(e);
          move_calc(e, dest, context, done);
      };
      context.scheduleThink(ent, context.timeSeconds + dt);
  }
}

function angle_move_calc(ent: Entity, dest: Vec3, context: EntitySystem, done: (ent: Entity, ctx: EntitySystem) => void) {
    const dt = 0.1;
    const vec = subtractVec3(dest, ent.angles);
    const dist = lengthVec3(vec);
    const dir = normalizeVec3(vec);
    const speed = ent.speed || 100;

    // Current speed from angular velocity (approximate)
    let currentSpeed = lengthVec3(ent.avelocity);

    // Accel
    if (ent.accel) {
        currentSpeed += ent.accel * dt;
    } else {
        currentSpeed = speed;
    }

    // Decel
    if (ent.decel) {
        const distToStop = (currentSpeed * currentSpeed) / (2 * ent.decel);
        if (dist <= distToStop) {
            currentSpeed -= ent.decel * dt;
            if (currentSpeed < 10) currentSpeed = 10;
        }
    }

    // Clamp
    if (currentSpeed > speed) currentSpeed = speed;

    const move = currentSpeed * dt;

    if (dist <= move) {
        // Finish this frame
        ent.avelocity = scaleVec3(dir, dist / dt);
        ent.think = (e) => {
            e.avelocity = { x: 0, y: 0, z: 0 };
            e.angles = { ...dest }; // Snap to final exact
            context.linkentity(e);
            done(e, context);
        };
        context.scheduleThink(ent, context.timeSeconds + dt);
    } else {
        // Continue
        ent.avelocity = scaleVec3(dir, currentSpeed);
        ent.think = (e) => {
            // runPush handles angle updates via avelocity
            angle_move_calc(e, dest, context, done);
        };
        context.scheduleThink(ent, context.timeSeconds + dt);
    }
}


// ============================================================================
// FUNC DOOR
// ============================================================================

export enum DoorState {
  Open,
  Opening,
  Closed,
  Closing,
}

const SPAWNFLAG_DOOR_START_OPEN = 1;
const SPAWNFLAG_DOOR_REVERSE = 2; // Shared with rotating
const SPAWNFLAG_DOOR_CRUSHER = 4;
const SPAWNFLAG_DOOR_NOMONSTER = 8;
const SPAWNFLAG_DOOR_ANIMATED = 16;
const SPAWNFLAG_DOOR_TOGGLE = 32;
const SPAWNFLAG_DOOR_ANIMATED_FAST = 64;

// Effects constants from q_shared.h/g_local.h
const EF_ANIM_ALL = 4;
const EF_ANIM_ALLFAST = 8;

// Local definition to handle legacy string sounds if needed, but should align with Entity definition
interface MoveInfo {
    sound_start: string | number | null;
    sound_middle: string | number | null;
    sound_end: string | number | null;
    reversing?: boolean;
    dir?: Vec3;
    speed?: number;
    accel?: number;
    decel?: number;
    wait?: number;
    start_origin?: Vec3;
    start_angles?: Vec3;
    end_origin?: Vec3;
    end_angles?: Vec3;
}

function getMoveInfo(ent: Entity): MoveInfo | undefined {
    return (ent as any).moveinfo;
}

function door_hit_top(ent: Entity, context: EntitySystem) {
  const moveinfo = getMoveInfo(ent);
  // Play end sound
  if (moveinfo && moveinfo.sound_end) {
      context.sound(ent, 0, String(moveinfo.sound_end), 1, 1, 0);
  }

  ent.state = DoorState.Open;
  if (ent.spawnflags & SPAWNFLAG_DOOR_TOGGLE) { // TOGGLE
       // Don't auto close
       return;
  }
  if (ent.wait === -1) {
       // Stay open
       return;
  }
  // Reuse door_go_down logic but handle sound carefully
  // door_go_down handles initiating the move.
  ent.think = (e) => door_go_down(e, context);
  context.scheduleThink(ent, context.timeSeconds + ent.wait);
}

function door_hit_bottom(ent: Entity, context: EntitySystem) {
  const moveinfo = getMoveInfo(ent);
  // Play end sound
  if (moveinfo && moveinfo.sound_end) {
      context.sound(ent, 0, String(moveinfo.sound_end), 1, 1, 0);
  }
  ent.state = DoorState.Closed;
}

function door_go_down(door: Entity, context: EntitySystem) {
  const moveinfo = getMoveInfo(door);
  if (moveinfo && moveinfo.sound_start) {
      context.sound(door, 0, String(moveinfo.sound_start), 1, 1, 0);
  }

  if (door.max_health) {
      door.takedamage = true;
      door.health = door.max_health;
  }

  door.state = DoorState.Closing;

  if (door.classname === 'func_door_rotating') {
       // Check if reversing for safe_open
       let dest = door.pos1; // Default to closed (pos1)
       // Wait, pos1 is closed state (angles).
       // If rotating door, go_down means closing.
       // So target is pos1.

       door.think = (e) => angle_move_calc(e, dest, context, door_hit_bottom);
       angle_move_calc(door, dest, context, door_hit_bottom);
  } else {
       door.think = (e) => move_calc(e, e.pos1, context, door_hit_bottom);
       move_calc(door, door.pos1, context, door_hit_bottom);
  }
}

function door_go_up(door: Entity, context: EntitySystem) {
  const moveinfo = getMoveInfo(door);
  if (moveinfo && moveinfo.sound_start) {
      context.sound(door, 0, String(moveinfo.sound_start), 1, 1, 0);
  }

  if (door.classname === 'func_door_rotating') {
      let dest = door.pos2;
      // Handle reversing logic if needed (e.g. SAFE_OPEN)
      if (moveinfo && moveinfo.reversing && (door as any).pos3) {
           dest = (door as any).pos3;
      }
      door.think = (e) => angle_move_calc(e, dest, context, door_hit_top);
      angle_move_calc(door, dest, context, door_hit_top);
  } else {
      door.think = (e) => move_calc(e, e.pos2, context, door_hit_top);
      move_calc(door, door.pos2, context, door_hit_top);
  }
}

const func_door: SpawnFunction = (entity, context) => {
  // Use context.entities instead of context because context is SpawnContext and we need EntitySystem
  const sys = context.entities;

  entity.movedir = setMovedir(entity.angles);
  if (!entity.speed) entity.speed = 100;
  if (!entity.wait) entity.wait = 3;
  if (!entity.lip) entity.lip = 8;
  if (!entity.dmg) entity.dmg = 2;
  if (!entity.health) entity.health = 0;
  entity.solid = Solid.Bsp;
  entity.movetype = MoveType.Push;

  // Capture context for blocked callback
  entity.blocked = (self, other) => {
      if (other && other.takedamage) {
        const damage = self.dmg || 2;
        if (self.spawnflags & SPAWNFLAG_DOOR_CRUSHER) {
            other.health -= damage;
        } else {
            other.health -= damage;
        }
      }

      if (self.spawnflags & SPAWNFLAG_DOOR_CRUSHER) {
          return;
      }

      if (self.state === DoorState.Opening) {
        self.state = DoorState.Closing;
        door_go_down(self, sys);
      } else if (self.state === DoorState.Closing) {
        self.state = DoorState.Opening;
        door_go_up(self, sys);
      }
  };

  entity.state = DoorState.Closed;
  entity.pos1 = { ...entity.origin };
  const move = entity.movedir.x * (Math.abs(entity.maxs.x - entity.mins.x) - entity.lip) +
               entity.movedir.y * (Math.abs(entity.maxs.y - entity.mins.y) - entity.lip) +
               entity.movedir.z * (Math.abs(entity.maxs.z - entity.mins.z) - entity.lip);
  entity.pos2 = addVec3(entity.pos1, scaleVec3(entity.movedir, move));

  // Handle sounds
  const moveinfo: MoveInfo = {
      sound_start: null,
      sound_middle: null,
      sound_end: null
  };
  if (entity.sounds !== 1) {
      // Default set 1
      moveinfo.sound_start = 'doors/dr1_strt.wav';
      moveinfo.sound_middle = 'doors/dr1_mid.wav';
      moveinfo.sound_end = 'doors/dr1_end.wav';
  }
  (entity as any).moveinfo = moveinfo;


  if (entity.spawnflags & SPAWNFLAG_DOOR_START_OPEN) { // START_OPEN
      entity.origin = { ...entity.pos2 };
      entity.state = DoorState.Open;
  }

  if (entity.spawnflags & SPAWNFLAG_DOOR_ANIMATED) {
      entity.effects |= EF_ANIM_ALL;
  }
  if (entity.spawnflags & SPAWNFLAG_DOOR_ANIMATED_FAST) {
      entity.effects |= EF_ANIM_ALLFAST;
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
    if (entity.spawnflags & SPAWNFLAG_DOOR_TOGGLE) { // TOGGLE
         if (self.state === DoorState.Closed) {
             self.state = DoorState.Opening;
             door_go_up(self, sys);
         } else if (self.state === DoorState.Open) {
             self.state = DoorState.Closing;
             door_go_down(self, sys);
         }
         return;
    }

    if (self.state !== DoorState.Closed) return;
    self.state = DoorState.Opening;
    door_go_up(self, sys);
  };

  if (entity.health <= 0 && !entity.targetname) {
      entity.touch = (self, other) => {
          if (!other) return;
          // NOMONSTER check
          if (self.spawnflags & SPAWNFLAG_DOOR_NOMONSTER) {
              if (other.svflags & ServerFlags.Monster) return;
          }
          if (other.classname !== 'player' && !(other.svflags & ServerFlags.Monster)) return;

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

// ============================================================================
// FUNC DOOR SECRET
// ============================================================================

const SPAWNFLAG_SECRET_ALWAYS_SHOOT = 1;
const SPAWNFLAG_SECRET_1ST_LEFT = 2;
const SPAWNFLAG_SECRET_1ST_DOWN = 4;

function door_secret_move1(ent: Entity, context: EntitySystem) {
    ent.nextthink = context.timeSeconds + 1.0;
    ent.think = (e) => door_secret_move2(e, context);
}

function door_secret_move2(ent: Entity, context: EntitySystem) {
    move_calc(ent, ent.pos2, context, door_secret_move3);
}

function door_secret_move3(ent: Entity, context: EntitySystem) {
    if (ent.wait === -1) {
        return;
    }
    ent.nextthink = context.timeSeconds + ent.wait;
    ent.think = (e) => door_secret_move4(e, context);
}

function door_secret_move4(ent: Entity, context: EntitySystem) {
    move_calc(ent, ent.pos1, context, door_secret_move5);
}

function door_secret_move5(ent: Entity, context: EntitySystem) {
    ent.nextthink = context.timeSeconds + 1.0;
    ent.think = (e) => door_secret_move6(e, context);
}

function door_secret_move6(ent: Entity, context: EntitySystem) {
    // Return to start_origin if available, otherwise 0,0,0 (as in C but safer)
    const dest: Vec3 = (ent as any).start_origin || { x: 0, y: 0, z: 0 };
    move_calc(ent, dest, context, door_secret_done);
}

function door_secret_done(ent: Entity, context: EntitySystem) {
    if (!ent.targetname || (ent.spawnflags & SPAWNFLAG_SECRET_ALWAYS_SHOOT)) {
        ent.health = 0;
        ent.takedamage = true;
    }
    // Real implementation would update PVS visibility here
}

function door_secret_blocked(self: Entity, other: Entity | null) {
    if (!other || !self.dmg) return;

    if (!(other.svflags & ServerFlags.Monster) && other.classname !== 'player') {
        // Gib/nuke non-monsters/players
        if (other.takedamage) {
            other.health = -1000; // Force gib
            // Call damage to handle gibbing logic if needed, or just let it be
        }
        return;
    }

    if (other.takedamage) {
        other.health -= self.dmg;
    }
}

export const func_door_secret: SpawnFunction = (entity, context) => {
    // Handle sounds
    const moveinfo: MoveInfo = {
        sound_start: 'doors/dr1_strt.wav',
        sound_middle: 'doors/dr1_mid.wav',
        sound_end: 'doors/dr1_end.wav'
    };
    (entity as any).moveinfo = moveinfo;

    entity.movetype = MoveType.Push;
    entity.solid = Solid.Bsp;
    entity.svflags |= ServerFlags.Door;

    entity.blocked = door_secret_blocked;

    entity.use = (self, other, activator) => {
        // make sure we're not already moving
        // Check if current origin is different from start_origin (assuming start is closed)
        const start = (self as any).start_origin || { x: 0, y: 0, z: 0 };
        // Simple check: if velocity is zero and we are at start, go.
        const d = distance(self.origin, start);
        if (d > 0.1) return; // Already moving or open

        move_calc(self, self.pos1, context.entities, door_secret_move1);
        // Real implementation would update PVS visibility here
    };

    if (!entity.targetname || (entity.spawnflags & SPAWNFLAG_SECRET_ALWAYS_SHOOT)) {
        entity.health = 0;
        entity.takedamage = true;
        entity.die = (self, inflictor, attacker, damage) => {
            self.takedamage = false;
            self.use?.(self, attacker, attacker);
        };
    }

    if (!entity.dmg) entity.dmg = 2;
    if (!entity.wait) entity.wait = 5;

    // Use speed, accel, decel from entity or defaults
    if (!entity.speed) entity.speed = 50;
    if (!entity.accel) entity.accel = 50;
    if (!entity.decel) entity.decel = 50;

    // Calculate positions
    const start_origin = { ...entity.origin };
    (entity as any).start_origin = start_origin;

    const { forward, right, up } = angleVectors(entity.angles);
    entity.angles = { x: 0, y: 0, z: 0 };

    const side = 1.0 - ((entity.spawnflags & SPAWNFLAG_SECRET_1ST_LEFT) ? 2 : 0);
    let width = 0;
    if (entity.spawnflags & SPAWNFLAG_SECRET_1ST_DOWN) {
        width = Math.abs(dotVec3(up, entity.size));
    } else {
        width = Math.abs(dotVec3(right, entity.size));
    }

    const length = Math.abs(dotVec3(forward, entity.size));

    // pos1 = start + (right * side * width) OR (up * -1 * width)
    if (entity.spawnflags & SPAWNFLAG_SECRET_1ST_DOWN) {
        const move = scaleVec3(up, -1 * width);
        entity.pos1 = addVec3(start_origin, move);
    } else {
        const move = scaleVec3(right, side * width);
        entity.pos1 = addVec3(start_origin, move);
    }

    // ent->pos2 = ent->pos1 + (forward * length);
    const forwardMove = scaleVec3(forward, length);
    entity.pos2 = addVec3(entity.pos1, forwardMove);

    if (entity.health) {
        entity.takedamage = true;
        entity.max_health = entity.health;
        entity.die = (self, inflictor, attacker, damage) => {
             self.takedamage = false;
             self.use?.(self, attacker, attacker);
        };
    } else if (entity.targetname && (entity as any).message) {
         entity.touch = (self, other) => {
            if (!other || !other.client) return;
             // Should print message
             // context.centerprintf(other, self.message);
         };
    }

    // Link entity (already done by spawn system generally, but ensuring solid/movetype set above)
};


// ============================================================================
// FUNC TRAIN
// ============================================================================

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

    // Use move_calc logic for trains?
    // Trains usually have path corners with "speed" property override?
    // And standard trains just move at constant speed.
    // If we want accel/decel on trains, we need to adapt it.
    // But func_train implementation here is basic.
    // Let's stick to existing train implementation for now unless requested.

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

// ============================================================================
// FUNC PLAT
// ============================================================================

enum PlatState {
    Up,
    Down,
    GoingUp,
    GoingDown,
}

// Plats have accel/decel properties by default.

function plat_hit_top(ent: Entity, context: EntitySystem) {
    ent.state = PlatState.Up;
    if (!(ent.spawnflags & 1)) {
         ent.think = plat_wait_top;
         context.scheduleThink(ent, context.timeSeconds + ent.wait);
    }
}

function plat_hit_bottom(ent: Entity, context: EntitySystem) {
    ent.state = PlatState.Down;
}

function plat_go_down(ent: Entity, context: EntitySystem) {
    move_calc(ent, ent.pos2, context, plat_hit_bottom);
}

function plat_go_up(ent: Entity, context: EntitySystem) {
    move_calc(ent, ent.pos1, context, plat_hit_top);
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

const PLAT2_LOW_TRIGGER = 1;
const PLAT2_TOGGLE = 2;
const PLAT2_TOP = 4;
const PLAT2_TRIGGER_TOP = 8;
const PLAT2_TRIGGER_BOTTOM = 16;
const PLAT2_BOX_LIFT = 32;

const PLAT2_CALLED = 1;
const PLAT2_WAITING = 2;
const PLAT2_MOVING = 4;

function plat2_spawn_danger_area(ent: Entity, context: EntitySystem) {
    // mins, maxs from ent
    // maxs[2] = ent->mins[2] + 64
    const mins = { ...ent.mins };
    const maxs = { ...ent.maxs };
    maxs.z = ent.mins.z + 64;

    // We can use the 'bad_area' trigger
    const badarea = context.spawn();
    badarea.classname = 'bad_area';
    badarea.origin = { ...ent.origin };
    badarea.mins = mins;
    badarea.maxs = maxs;
    badarea.solid = Solid.Trigger;
    badarea.movetype = MoveType.None;
    badarea.owner = ent;

    // Custom touch for bad area?
    // Using default bad_area behavior which should push/warn AI
    context.linkentity(badarea);

    // We need to store it to remove it later?
    // C code finds it by owner
}

function plat2_kill_danger_area(ent: Entity, context: EntitySystem) {
    // Find bad_area owned by ent
    // Since we don't have G_Find easily by owner/classname combo (can use filter)
    const candidates = context.findByClassname('bad_area');
    for (const area of candidates) {
        if (area.owner === ent) {
            context.free(area);
        }
    }
}

function plat2_hit_top(ent: Entity, context: EntitySystem) {
    if (!(ent.flags & EntityFlags.TeamSlave)) {
        const moveinfo = getMoveInfo(ent);
        if (moveinfo && moveinfo.sound_end) {
            context.sound(ent, 0, String(moveinfo.sound_end), 1, 1, 0);
        }
        ent.sounds = 0;
    }
    // Cast to any to avoid MoveInfo type issues for now, or ensure MoveInfo definition in entity.ts includes 'state'
    (ent.moveinfo as any).state = PlatState.Up; // STATE_TOP

    if (ent.plat2flags & PLAT2_CALLED) {
        ent.plat2flags = PLAT2_WAITING;
        if (!(ent.spawnflags & PLAT2_TOGGLE)) {
            ent.think = (e) => plat2_go_down(e, context);
            context.scheduleThink(ent, context.timeSeconds + 5.0);
        }
        ent.last_move_time = context.timeSeconds - (context.deathmatch ? 1.0 : 2.0);
    } else if (!(ent.spawnflags & PLAT2_TOP) && !(ent.spawnflags & PLAT2_TOGGLE)) {
        ent.plat2flags = 0;
        ent.think = (e) => plat2_go_down(e, context);
        context.scheduleThink(ent, context.timeSeconds + 2.0);
        ent.last_move_time = context.timeSeconds;
    } else {
        ent.plat2flags = 0;
        ent.last_move_time = context.timeSeconds;
    }

    if (ent.spawnflags & PLAT2_TRIGGER_TOP) {
        context.useTargets(ent, ent);
    }
}

function plat2_hit_bottom(ent: Entity, context: EntitySystem) {
    if (!(ent.flags & EntityFlags.TeamSlave)) {
        const moveinfo = getMoveInfo(ent);
        if (moveinfo && moveinfo.sound_end) {
            context.sound(ent, 0, String(moveinfo.sound_end), 1, 1, 0);
        }
        ent.sounds = 0;
    }
    (ent.moveinfo as any).state = PlatState.Down; // STATE_BOTTOM

    if (ent.plat2flags & PLAT2_CALLED) {
        ent.plat2flags = PLAT2_WAITING;
        if (!(ent.spawnflags & PLAT2_TOGGLE)) {
            ent.think = (e) => plat2_go_up(e, context);
            context.scheduleThink(ent, context.timeSeconds + 5.0);
        }
        ent.last_move_time = context.timeSeconds - (context.deathmatch ? 1.0 : 2.0);
    } else if ((ent.spawnflags & PLAT2_TOP) && !(ent.spawnflags & PLAT2_TOGGLE)) {
        ent.plat2flags = 0;
        ent.think = (e) => plat2_go_up(e, context);
        context.scheduleThink(ent, context.timeSeconds + 2.0);
        ent.last_move_time = context.timeSeconds;
    } else {
        ent.plat2flags = 0;
        ent.last_move_time = context.timeSeconds;
    }

    plat2_kill_danger_area(ent, context);
    if (ent.spawnflags & PLAT2_TRIGGER_BOTTOM) {
        context.useTargets(ent, ent);
    }
}

function plat2_go_down(ent: Entity, context: EntitySystem) {
    if (!(ent.flags & EntityFlags.TeamSlave)) {
        const moveinfo = getMoveInfo(ent);
        if (moveinfo && moveinfo.sound_start) {
            context.sound(ent, 0, String(moveinfo.sound_start), 1, 1, 0);
        }
        ent.sounds = 0; // Don't assign string to number
        if (moveinfo?.sound_middle) {
             // If sound_middle is a string/index, handle it.
             // For now just 0 as we don't have easy lookup here without casting
             // or assume it was precached and stored as index if we fixed initialization
        }
    }
    (ent.moveinfo as any).state = PlatState.GoingDown; // STATE_DOWN
    ent.plat2flags |= PLAT2_MOVING;

    move_calc(ent, ent.moveinfo!.end_origin!, context, plat2_hit_bottom);
}

function plat2_go_up(ent: Entity, context: EntitySystem) {
    if (!(ent.flags & EntityFlags.TeamSlave)) {
        const moveinfo = getMoveInfo(ent);
        if (moveinfo && moveinfo.sound_start) {
            context.sound(ent, 0, String(moveinfo.sound_start), 1, 1, 0);
        }
        ent.sounds = 0;
    }
    (ent.moveinfo as any).state = PlatState.GoingUp; // STATE_UP
    ent.plat2flags |= PLAT2_MOVING;

    plat2_spawn_danger_area(ent, context);

    move_calc(ent, ent.moveinfo!.start_origin!, context, plat2_hit_top);
}

function plat2_operate(ent: Entity, other: Entity | null | undefined, context: EntitySystem) {
    if (!other) return;
    // ent is trigger, ent.enemy is plat
    const trigger = ent;
    const plat = ent.enemy!; // Should be set

    if (plat.plat2flags & PLAT2_MOVING) return;
    if ((plat.last_move_time + 2) > context.timeSeconds) return;

    const platCenter = (trigger.absmin.z + trigger.absmax.z) / 2;
    let otherState: PlatState;

    const state = (plat.moveinfo as any).state as PlatState;

    if (state === PlatState.Up) { // STATE_TOP
        otherState = PlatState.Up;
        if (plat.spawnflags & PLAT2_BOX_LIFT) {
            if (platCenter > other.origin.z) {
                otherState = PlatState.Down;
            }
        } else {
            if (trigger.absmax.z > other.origin.z) {
                otherState = PlatState.Down;
            }
        }
    } else {
        otherState = PlatState.Down;
        if (other.origin.z > platCenter) {
            otherState = PlatState.Up;
        }
    }

    plat.plat2flags = PLAT2_MOVING;

    let pauseTime = context.deathmatch ? 0.3 : 0.5;

    if (state !== otherState) {
        plat.plat2flags |= PLAT2_CALLED;
        pauseTime = 0.1;
    }

    plat.last_move_time = context.timeSeconds;

    if (state === PlatState.Down) { // STATE_BOTTOM
        plat.think = (e) => plat2_go_up(e, context);
        context.scheduleThink(plat, context.timeSeconds + pauseTime);
    } else {
        plat.think = (e) => plat2_go_down(e, context);
        context.scheduleThink(plat, context.timeSeconds + pauseTime);
    }
}

function touch_plat_center2(ent: Entity, other: Entity | null, context: EntitySystem) {
    if (!other || other.health <= 0) return;
    if (!(other.svflags & ServerFlags.Monster) && !other.client) return;

    plat2_operate(ent, other, context);
}

function plat2_blocked(self: Entity, other: Entity | null, context: EntitySystem) {
    if (!other) return;

    // Damage logic similar to C code
    // If not monster/client, gib it
    if (!(other.svflags & ServerFlags.Monster) && !other.client) {
        if (other.takedamage) {
             other.health = -1000;
             // damage call to trigger death/gib?
             // Since we don't have T_Damage imported fully with all args, we simulate:
             // Actually we imported T_Damage.
             // T_Damage(other, self, self, ...)
             // Just setting health low and let next frame handle or call die?
             // Calling die directly if possible.
             if (other.die) {
                 other.die(other, self, self, 100000, other.origin, DamageMod.CRUSH);
             }
        }
        return;
    }

    if (other.health > 0) {
        // Apply damage
        const dmg = self.dmg || 2;
        other.health -= dmg;
        // Pain/Die handling handled by system usually, but blocked callback might need to trigger it
    }

    const state = (self.moveinfo as any).state as PlatState;
    if (state === PlatState.GoingUp) { // STATE_UP
        plat2_go_down(self, context);
    } else if (state === PlatState.GoingDown) { // STATE_DOWN
        plat2_go_up(self, context);
    }
}

function use_plat2(ent: Entity, other: Entity | null | undefined, activator: Entity | null | undefined, context: EntitySystem) {
    // This is called when the plat itself is used (not the trigger)
    // Or via plat2_activate setting use to this.
    // Iterates triggers
    const state = (ent.moveinfo as any).state as number;
    if (state > (PlatState.Down as number)) return; // Moving?
    if ((ent.last_move_time + 2) > context.timeSeconds) return;

    // Find trigger
    // Since we don't have global list easily, we rely on the fact that the trigger has 'enemy' pointing to ent
    // We can search all entities... expensive.
    // Or just spawn the trigger and keep track?
    // C code iterates all edicts.

    // Optimization: find by classname 'plat_trigger' and check enemy
    const triggers = context.findByClassname('plat_trigger');
    for (const trigger of triggers) {
        if (trigger.enemy === ent) {
            plat2_operate(trigger, activator || other || ent, context);
            return;
        }
    }
}

function plat2_activate(ent: Entity, other: Entity | null | undefined, activator: Entity | null | undefined, context: EntitySystem) {
    ent.use = (self, o, a) => use_plat2(self, o, a, context);

    const trigger = plat_spawn_inside_trigger(ent, context);
    if (trigger) {
        trigger.touch = (t, o) => touch_plat_center2(t, o, context);
        // Expand trigger size for debugging/logic? C code does:
        trigger.maxs = {
            x: trigger.maxs.x + 10,
            y: trigger.maxs.y + 10,
            z: trigger.maxs.z
        };
        trigger.mins = {
            x: trigger.mins.x - 10,
            y: trigger.mins.y - 10,
            z: trigger.mins.z
        };
        context.linkentity(trigger);
    }

    plat2_go_down(ent, context);
}

// Reimplement plat_spawn_inside_trigger for reuse or use existing logic from func_plat if extractable
// But func_plat has it inline. Let's extract.
function plat_spawn_inside_trigger(ent: Entity, context: EntitySystem) {
    const trigger = context.spawn();
    trigger.touch = (t, o) => touch_plat_center2(t, o, context); // Default
    trigger.movetype = MoveType.None;
    trigger.solid = Solid.Trigger;
    trigger.enemy = ent;
    trigger.classname = 'plat_trigger';

    const tmin = { ...ent.mins };
    const tmax = { ...ent.maxs };

    tmin.x += 25;
    tmin.y += 25;
    tmax.x -= 25;
    tmax.y -= 25;
    tmax.z = ent.maxs.z + 8;

    // tmin[2] = tmax[2] - (ent->pos1[2] - ent->pos2[2] + st.lip);
    const height = (ent.pos1.z - ent.pos2.z) + (ent.lip || 8);
    tmin.z = tmax.z - height;

    if (ent.spawnflags & 1) { // PLAT_LOW_TRIGGER
        tmax.z = tmin.z + 8;
    }

    if (tmax.x - tmin.x <= 0) {
        tmin.x = (ent.mins.x + ent.maxs.x) * 0.5;
        tmax.x = tmin.x + 1;
    }
    if (tmax.y - tmin.y <= 0) {
        tmin.y = (ent.mins.y + ent.maxs.y) * 0.5;
        tmax.y = tmin.y + 1;
    }

    trigger.mins = tmin;
    trigger.maxs = tmax;

    context.linkentity(trigger);
    return trigger;
}

const func_plat2: SpawnFunction = (entity, context) => {
    // Setup similar to func_plat
    entity.movedir = setMovedir(entity.angles);
    entity.angles = { x: 0, y: 0, z: 0 };

    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;

    // Set model done by system

    entity.blocked = (self, other) => plat2_blocked(self, other, context.entities);

    if (!entity.speed) entity.speed = 20;
    else entity.speed *= 0.1; // C code scaling

    if (!entity.accel) entity.accel = 5;
    else entity.accel *= 0.1;

    if (!entity.decel) entity.decel = 5;
    else entity.decel *= 0.1;

    if (context.entities.deathmatch) {
        entity.speed *= 2;
        entity.accel *= 2;
        entity.decel *= 2;
    }

    if (!entity.dmg) entity.dmg = 2;
    if (!entity.wait) entity.wait = 3;
    if (!entity.lip) entity.lip = 8;

    // pos1 top, pos2 bottom
    entity.pos1 = { ...entity.origin };
    entity.pos2 = { ...entity.origin };

    if (entity.height) {
        entity.pos2 = { ...entity.pos2, z: entity.pos2.z - (entity.height - entity.lip) };
    } else {
        entity.pos2 = { ...entity.pos2, z: entity.pos2.z - ((entity.maxs.z - entity.mins.z) - entity.lip) };
    }

    // Set up moveinfo
    const moveinfo: MoveInfo = {
        speed: entity.speed,
        accel: entity.accel,
        decel: entity.decel,
        wait: entity.wait,
        start_origin: { ...entity.pos1 },
        start_angles: { ...entity.angles },
        end_origin: { ...entity.pos2 },
        end_angles: { ...entity.angles },
        sound_start: 'plats/pt1_strt.wav',
        sound_middle: 'plats/pt1_mid.wav',
        sound_end: 'plats/pt1_end.wav'
    };

    // Manually add state to bypass type checking for now since local interface is incomplete
    (moveinfo as any).state = PlatState.Up; // STATE_TOP

    // cast to any to bypass strict type checking if moveinfo from entity has stricter type
    // Entity.moveinfo is MoveInfo (which has numbers)
    (entity as any).moveinfo = moveinfo;

    if (entity.targetname) {
        entity.use = (self, other, activator) => plat2_activate(self, other, activator, context.entities);
    } else {
        entity.use = (self, other, activator) => use_plat2(self, other, activator, context.entities);

        const trigger = plat_spawn_inside_trigger(entity, context.entities);
        // PGM debugging adjustment from C code
        trigger.maxs = {
            x: trigger.maxs.x + 10,
            y: trigger.maxs.y + 10,
            z: trigger.maxs.z
        };
        trigger.mins = {
            x: trigger.mins.x - 10,
            y: trigger.mins.y - 10,
            z: trigger.mins.z
        };

        context.entities.linkentity(trigger);
        trigger.touch = (t, o) => touch_plat_center2(t, o, context.entities);

        if (!(entity.spawnflags & PLAT2_TOP)) {
            entity.origin = { ...entity.pos2 };
            (moveinfo as any).state = PlatState.Down; // STATE_BOTTOM
        }
    }

    context.entities.linkentity(entity);
};

// ============================================================================
// FUNC PENDULUM
// ============================================================================

function pendulum_swing(ent: Entity, context: EntitySystem) {
    let nextThink = ent.nextthink + 0.1;
    // Calculate new angle based on time
    const freq = ent.speed || 0.1; // Using speed as frequency?
    // In Quake 2, func_pendulum uses:
    // angle = phase + speed * time
    // But we need to check how it was implemented in original source.
    // g_func.cpp: SP_func_pendulum
    // It sets avelocity? No, it likely updates angles in think.

    // Original Q2 logic:
    /*
    float x = (level.time * self->speed + self->phase);
    float y = sin(x * M_PI * 2);
    self->s.angles[2] = self->move_angles[2] + y * self->distance;
    */
    // Default axis is Z rotation (Roll)

    // We need ent.phase and ent.move_angles and ent.distance
    // ent.speed is frequency (Hz? or radians per second?)
    // In g_func.cpp: if (!self.speed) self.speed = 30;

    // Wait, speed is usually degrees per second for rotating stuff.
    // But for pendulum it might be degrees of swing?
    // "speed" is degrees per second.
    // "distance" is degrees of swing.
    // "phase" is 0-360 start offset.

    // Actually looking at g_func.cpp:
    /*
    void pendulum_use (edict_t *ent, edict_t *other, edict_t *activator)
    {
        ent->use = NULL;
        ent->think = pendulum_think;
        ent->nextthink = level.time + 0.1;
    }

    void pendulum_think (edict_t *ent)
    {
        ent->nextthink = level.time + 0.1;
        ent->s.angles[2] = ent->move_angles[2] + sin(level.time * ent->speed) * ent->distance;
        gi.linkentity (ent);
    }
    */
    // Wait, level.time * ent.speed inside sin?
    // So if speed is 1, it completes a cycle every 2*PI seconds (approx 6.28s).
    // Usually speed is small here.

    // Let's implement based on this simplified view:
    const time = context.timeSeconds;
    const speed = ent.speed || 1;
    const dist = (ent as any).distance || 90;
    const baseAngle = (ent as any).move_angles?.z || 0;

    const angleDelta = Math.sin(time * speed) * dist;

    // We only modify Z angle (roll)?
    // Q2 usually swings around Y axis (so changes Z angle) or X axis?
    // ent->s.angles[2] is Roll (Z).

    ent.angles = {
        x: ent.angles.x,
        y: ent.angles.y,
        z: baseAngle + angleDelta
    };

    context.linkentity(ent);
    context.scheduleThink(ent, time + 0.1);
}

const func_pendulum: SpawnFunction = (entity, context) => {
    entity.solid = Solid.Bsp;
    entity.movetype = MoveType.Push;

    if (!entity.speed) entity.speed = 30; // Default?
    // Speed in Q2 pendulum seems to be treated as a multiplier for time in sin().

    (entity as any).move_angles = { ...entity.angles };
    (entity as any).distance = entity.dmg || 90; // Using dmg field for distance if not set?
    // In Q2, 'dmg' is damage on block. 'distance' is separate key.

    const distKey = context.keyValues.distance;
    if (distKey) {
        (entity as any).distance = parseFloat(distKey);
    }

    // If targeted, wait for use
    if (entity.targetname) {
        entity.use = (self) => {
            self.use = undefined;
            self.think = (e) => pendulum_swing(e, context.entities);
            context.entities.scheduleThink(self, context.entities.timeSeconds + 0.1);
        };
    } else {
        entity.think = (e) => pendulum_swing(e, context.entities);
        context.entities.scheduleThink(entity, context.entities.timeSeconds + 0.1);
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
// FUNC ROTATING
// ============================================================================

export const SP_func_rotating: SpawnFunction = (entity, context) => {
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
// FUNC DOOR ROTATING
// ============================================================================

const SPAWNFLAG_DOOR_ROTATING_X_AXIS = 64;
const SPAWNFLAG_DOOR_ROTATING_Y_AXIS = 128;
const SPAWNFLAG_DOOR_ROTATING_INACTIVE = 0x10000;
const SPAWNFLAG_DOOR_ROTATING_SAFE_OPEN = 0x20000;

export const func_door_rotating: SpawnFunction = (entity, context) => {
    // Handling SAFE_OPEN
    if (entity.spawnflags & SPAWNFLAG_DOOR_ROTATING_SAFE_OPEN) {
        // G_SetMovedir logic is slightly different, but let's assume standard angular logic
        // for determining "forward" from angles.
        entity.movedir = setMovedir(entity.angles);
        // Store this direction for safe_open check?
        // In C it sets ent.moveinfo.dir = forward vector of angles.
        // We can store it on moveinfo.
    }
    const safeOpenDir = { ...entity.movedir };

    // Reset angles? C says VectorClear(ent->s.angles);
    entity.angles = { x: 0, y: 0, z: 0 };

    // set the axis of rotation in movedir
    entity.movedir = { x: 0, y: 0, z: 0 };
    if (entity.spawnflags & SPAWNFLAG_DOOR_ROTATING_X_AXIS) {
        entity.movedir = { x: 0, y: 0, z: 1.0 }; // Index 2 -> Z
    } else if (entity.spawnflags & SPAWNFLAG_DOOR_ROTATING_Y_AXIS) {
        entity.movedir = { x: 1.0, y: 0, z: 0 }; // Index 0 -> X
    } else {
        // Z_AXIS (Default)
        entity.movedir = { x: 0, y: 1.0, z: 0 }; // Index 1 -> Y
    }

    // check for reverse rotation
    if (entity.spawnflags & SPAWNFLAG_DOOR_REVERSE) {
        entity.movedir = scaleVec3(entity.movedir, -1);
    }

    // Distance
    let dist = (entity as any).distance;
    if (!dist) {
         context.warn(`${entity.classname}: no distance set`);
         dist = 90;
    }

    entity.pos1 = { ...entity.angles };
    entity.pos2 = addVec3(entity.angles, scaleVec3(entity.movedir, dist));
    (entity as any).pos3 = addVec3(entity.angles, scaleVec3(entity.movedir, -dist)); // Reversed

    entity.movetype = MoveType.Push;
    entity.solid = Solid.Bsp;
    entity.svflags |= ServerFlags.Door;

    // Use shared door callbacks
    entity.blocked = (self, other) => {
        // door_blocked logic
        if (other && other.takedamage) {
            const damage = self.dmg || 2;
             if (self.spawnflags & SPAWNFLAG_DOOR_CRUSHER) {
                 other.health -= damage;
             } else {
                 other.health -= damage;
             }
        }
        if (self.spawnflags & SPAWNFLAG_DOOR_CRUSHER) return;

        // Reverse if blocked?
        if (self.state === DoorState.Opening) {
             self.state = DoorState.Closing;
             door_go_down(self, context.entities);
        } else if (self.state === DoorState.Closing) {
             self.state = DoorState.Opening;
             door_go_up(self, context.entities);
        }
    };

    entity.use = (self, other, activator) => {
        // door_use logic
        // Check SAFE_OPEN
        const moveinfo = getMoveInfo(self);
        if (moveinfo && (self.spawnflags & SPAWNFLAG_DOOR_ROTATING_SAFE_OPEN)) {
            if (self.state === DoorState.Closed || self.state === DoorState.Closing) {
                 // Check activator position vs door
                 if (activator && moveinfo.dir) {
                     const forward = normalizeVec3(subtractVec3(activator.origin, self.origin));
                     // Use moveinfo.dir (which we saved as safeOpenDir earlier but lost scope?
                     // Need to store it in moveinfo.
                     if (dotVec3(forward, moveinfo.dir) > 0) {
                         moveinfo.reversing = true;
                     } else {
                         moveinfo.reversing = false;
                     }
                 }
            }
        }

        if (self.spawnflags & SPAWNFLAG_DOOR_TOGGLE) {
            if (self.state === DoorState.Open || self.state === DoorState.Opening) {
                 // Close
                 self.state = DoorState.Closing;
                 door_go_down(self, context.entities);
                 return;
            }
        }

        if (self.state !== DoorState.Closed) return;
        self.state = DoorState.Opening;
        door_go_up(self, context.entities);
    };

    if (!entity.speed) entity.speed = 100;
    if (!entity.wait) entity.wait = 3;
    if (!entity.dmg) entity.dmg = 2;

    // Handle sounds
    const moveinfo: MoveInfo = {
        sound_start: 'doors/dr1_strt.wav',
        sound_middle: 'doors/dr1_mid.wav',
        sound_end: 'doors/dr1_end.wav',
        dir: safeOpenDir
    };
    if (entity.sounds !== 1) {
        // Default set 1
    } else {
        moveinfo.sound_start = null;
        moveinfo.sound_middle = null;
        moveinfo.sound_end = null;
    }
    (entity as any).moveinfo = moveinfo;

    // START_OPEN logic
    if (entity.spawnflags & SPAWNFLAG_DOOR_START_OPEN) {
        if (entity.spawnflags & SPAWNFLAG_DOOR_ROTATING_SAFE_OPEN) {
             context.warn(`${entity.classname}: SAFE_OPEN is not compatible with START_OPEN`);
             entity.spawnflags &= ~SPAWNFLAG_DOOR_ROTATING_SAFE_OPEN;
        }
        // Swap pos1/pos2
        const temp = entity.pos2;
        entity.pos2 = entity.pos1;
        entity.pos1 = temp;

        entity.movedir = scaleVec3(entity.movedir, -1);
        entity.angles = { ...entity.pos1 }; // Start at pos1 (which was old pos2)
    }

    if (entity.health) {
        entity.takedamage = true;
        entity.max_health = entity.health;
        entity.die = (self, inflictor, attacker, damage) => {
             self.takedamage = false;
             self.use?.(self, attacker, attacker);
        };
    }

    if (entity.targetname && (entity as any).message) {
         entity.touch = (self, other) => {
             if (!other || !other.client) return;
             // print message
         };
    }

    entity.state = DoorState.Closed; // pos1

    // Need to capture the standard door logic use callback
    const door_use_wrapper = entity.use;

    // INACTIVE logic
    if (entity.spawnflags & SPAWNFLAG_DOOR_ROTATING_INACTIVE) {
         entity.takedamage = false;
         entity.die = undefined;
         entity.think = undefined;
         entity.nextthink = 0;
         entity.use = (self, other, activator) => {
             // Activate
             self.use = door_use_wrapper; // Switch to normal use
             if (self.health) {
                 self.takedamage = true;
                 self.die = (s, i, a, d) => {
                     s.takedamage = false;
                     s.use?.(s, a, a);
                 };
             }
             // Call use immediately?
             if (self.use) {
                 self.use(self, other, activator);
             }
         };
    }

    if (entity.spawnflags & SPAWNFLAG_DOOR_ANIMATED) {
        entity.effects |= EF_ANIM_ALL;
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

const SPAWNFLAGS_EXPLOSIVE_TRIGGER_SPAWN = 1;
const SPAWNFLAGS_EXPLOSIVE_ANIMATED = 2;
const SPAWNFLAGS_EXPLOSIVE_ANIMATED_FAST = 4;
const SPAWNFLAGS_EXPLOSIVE_INACTIVE = 8;
const SPAWNFLAGS_EXPLOSIVE_ALWAYS_SHOOTABLE = 16;

const func_explosive: SpawnFunction = (entity, context) => {
    const sys = context.entities;

    entity.movetype = MoveType.Push;

    // Models for debris are handled by throwGibs, but func_explosive itself might have a model set by map
    // (it is a brush entity, so it has a model)

    const func_explosive_spawn = (self: Entity, other: Entity | null, activator: Entity | null | undefined) => {
        self.solid = Solid.Bsp;
        self.svflags &= ~ServerFlags.NoClient;
        self.use = undefined;
        sys.linkentity(self);
        sys.killBox(self);
    };

    const func_explosive_explode = (self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number) => {
        self.takedamage = false;

        // Cast back to Entity since we know self is an Entity in this context and T_RadiusDamage expects Damageable but logic uses Entity properties
        // Wait, self in die callback IS Entity.
        const ent = self;

        if (ent.dmg) {
            // T_RadiusDamage signature: entities, inflictor, attacker, damage, ignore, radius, dflags, mod, time, options, multicast
            // Get candidate entities for radius damage using findByRadius (optimization)
            const radius = ent.dmg + 40;
            const candidates = sys.findByRadius(ent.origin, radius);
            // Convert Entity[] to Damageable[] (Entity implements Damageable)
            const damageables = candidates as unknown as Damageable[];

            T_RadiusDamage(damageables, ent as unknown as Damageable, attacker as unknown as Damageable, ent.dmg, null, radius, DamageFlags.NONE, DamageMod.EXPLOSIVE, sys.timeSeconds, {}, sys.multicast.bind(sys));
        }

        const mass = ent.mass || 75;

        // big chunks
        if (mass >= 100) {
            let count = Math.floor(mass / 100);
            if (count > 8) count = 8;
            throwGibs(sys, ent.origin, [
                { count, model: "models/objects/debris1/tris.md2", flags: GIB_METALLIC | GIB_DEBRIS }
            ]);
        }

        // small chunks
        let count = Math.floor(mass / 25);
        if (count > 16) count = 16;
        throwGibs(sys, ent.origin, [
            { count, model: "models/objects/debris2/tris.md2", flags: GIB_METALLIC | GIB_DEBRIS }
        ]);

        sys.useTargets(ent, attacker as Entity);

        // Sound
        if ((ent as any).noise_index) {
            sys.sound(ent, 0, (ent as any).noise_index, 1, 1, 0);
        }

        if (ent.dmg) {
            // BecomeExplosion1
            // Placeholder: free for now, real explosion effect needs TE_EXPLOSION1
            // sys.multicast(self.origin, ... TE_EXPLOSION1)
            sys.free(ent);
        } else {
            sys.free(ent);
        }
    };

    const func_explosive_use = (self: Entity, other: Entity | null, activator: Entity | null | undefined) => {
        func_explosive_explode(self, self, activator || null, self.health);
    };

    const func_explosive_activate = (self: Entity, other: Entity | null, activator: Entity | null | undefined) => {
        let approved = false;
        if (other && other.target && self.targetname && other.target === self.targetname) {
            approved = true;
        }
        if (!approved && activator && activator.target && self.targetname && activator.target === self.targetname) {
            approved = true;
        }

        if (!approved) return;

        self.use = func_explosive_use;
        if (!self.health) self.health = 100;
        self.die = func_explosive_explode;
        self.takedamage = true;
    };

    if (entity.spawnflags & SPAWNFLAGS_EXPLOSIVE_TRIGGER_SPAWN) {
        entity.svflags |= ServerFlags.NoClient;
        entity.solid = Solid.Not;
        entity.use = func_explosive_spawn;
    } else if (entity.spawnflags & SPAWNFLAGS_EXPLOSIVE_INACTIVE) {
        entity.solid = Solid.Bsp;
        if (entity.targetname) {
            entity.use = func_explosive_activate;
        }
    } else {
        entity.solid = Solid.Bsp;
        if (entity.targetname) {
            entity.use = func_explosive_use;
        }
    }

    if (entity.spawnflags & SPAWNFLAGS_EXPLOSIVE_ANIMATED) {
        entity.effects |= EF_ANIM_ALL;
    }
    if (entity.spawnflags & SPAWNFLAGS_EXPLOSIVE_ANIMATED_FAST) {
        entity.effects |= EF_ANIM_ALLFAST;
    }

    if ((entity.spawnflags & SPAWNFLAGS_EXPLOSIVE_ALWAYS_SHOOTABLE) ||
        (entity.use !== func_explosive_use && entity.use !== func_explosive_activate)) {
        if (!entity.health) entity.health = 100;
        entity.die = func_explosive_explode;
        entity.takedamage = true;
    }

    // Handle sounds
    if (entity.sounds === 1) {
        // entity.noise_index = sys.soundIndex("world/brkglas.wav");
        // Need to add noise_index to Entity or use loose typing
        (entity as any).noise_index = "world/brkglas.wav"; // Use string for now if soundIndex is not available on sys direct or mock
    }
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

// ============================================================================
// FUNC TIMER
// ============================================================================

const SPAWNFLAG_TIMER_START_ON = 1;

const func_timer: SpawnFunction = (entity, context) => {
    if (!entity.wait) entity.wait = 1.0;

    const func_timer_think = (self: Entity, ctx: EntitySystem) => {
        ctx.useTargets(self, self.activator);
        const variance = ctx.rng.crandom() * self.random;
        const nextTime = self.wait + variance;
        ctx.scheduleThink(self, ctx.timeSeconds + nextTime);
    };

    entity.use = (self, other, activator) => {
        self.activator = activator || null;

        // If on, turn it off
        if (self.nextthink > 0) {
            self.nextthink = 0;
            self.think = undefined;
            return;
        }

        // Turn it on
        if (self.delay) {
            self.think = (e) => func_timer_think(e, context.entities);
            context.entities.scheduleThink(self, context.entities.timeSeconds + self.delay);
        } else {
            func_timer_think(self, context.entities);
        }
    };

    if (entity.random >= entity.wait) {
        entity.random = entity.wait - 0.05; // frame_time_s approx
        context.warn(`${entity.classname}: random >= wait`);
    }

    if (entity.spawnflags & SPAWNFLAG_TIMER_START_ON) {
        entity.activator = entity;
        const pausetime = (entity as any).pausetime || 0;
        const delay = entity.delay || 0;

        const variance = context.entities.rng.crandom() * entity.random;
        const nextTime = 1.0 + pausetime + delay + entity.wait + variance;

        entity.think = (e) => func_timer_think(e, context.entities);
        context.entities.scheduleThink(entity, context.entities.timeSeconds + nextTime);
    }

    entity.svflags |= ServerFlags.NoClient;
};

// ============================================================================
// FUNC WALL
// ============================================================================

const SPAWNFLAG_WALL_TRIGGER_SPAWN = 1;
const SPAWNFLAG_WALL_TOGGLE = 2;
const SPAWNFLAG_WALL_START_ON = 4;
const SPAWNFLAG_WALL_ANIMATED = 8;
const SPAWNFLAG_WALL_ANIMATED_FAST = 16;

const func_wall_use = (self: Entity, other: Entity | null, activator: Entity | null, context: EntitySystem) => {
    if (self.solid === Solid.Not) {
        self.solid = Solid.Bsp;
        self.svflags &= ~ServerFlags.NoClient;
        context.linkentity(self);
        context.killBox(self);
    } else {
        self.solid = Solid.Not;
        self.svflags |= ServerFlags.NoClient;
        context.linkentity(self);
    }

    if (!(self.spawnflags & SPAWNFLAG_WALL_TOGGLE)) {
        self.use = undefined;
    }
};

export const func_wall: SpawnFunction = (entity, context) => {
    entity.movetype = MoveType.Push;
    // entity.model is set by spawn system

    if (entity.spawnflags & SPAWNFLAG_WALL_ANIMATED) {
        entity.effects |= EF_ANIM_ALL;
    }
    if (entity.spawnflags & SPAWNFLAG_WALL_ANIMATED_FAST) {
        entity.effects |= EF_ANIM_ALLFAST;
    }

    // Just a wall
    if (!(entity.spawnflags & (SPAWNFLAG_WALL_TRIGGER_SPAWN | SPAWNFLAG_WALL_TOGGLE | SPAWNFLAG_WALL_START_ON))) {
        entity.solid = Solid.Bsp;
        // linkentity done by system
        return;
    }

    // It must be TRIGGER_SPAWN (if any of the above flags are set, it implies trigger behavior logic is needed,
    // but C code specifically checks if not any of them -> solid. Else forces TRIGGER_SPAWN if not set?)
    // C code:
    // if (!(self->spawnflags & (SPAWNFLAG_WALL_TRIGGER_SPAWN | SPAWNFLAG_WALL_TOGGLE | SPAWNFLAG_WALL_START_ON))) ... return;
    // if (!(self->spawnflags & SPAWNFLAG_WALL_TRIGGER_SPAWN)) self->spawnflags |= SPAWNFLAG_WALL_TRIGGER_SPAWN;

    if (!(entity.spawnflags & SPAWNFLAG_WALL_TRIGGER_SPAWN)) {
        entity.spawnflags |= SPAWNFLAG_WALL_TRIGGER_SPAWN;
    }

    // Warn if odd flags
    if (entity.spawnflags & SPAWNFLAG_WALL_START_ON) {
        if (!(entity.spawnflags & SPAWNFLAG_WALL_TOGGLE)) {
            console.log("func_wall START_ON without TOGGLE");
            entity.spawnflags |= SPAWNFLAG_WALL_TOGGLE;
        }
    }

    entity.use = (self, other, activator) => func_wall_use(self, other, activator || null, context.entities);

    if (entity.spawnflags & SPAWNFLAG_WALL_START_ON) {
        entity.solid = Solid.Bsp;
    } else {
        entity.solid = Solid.Not;
        entity.svflags |= ServerFlags.NoClient;
    }

    // linkentity done by system
};


export function registerFuncSpawns(registry: SpawnRegistry) {
  registry.register('func_wall', func_wall);
  registry.register('func_door', func_door);
  registry.register('func_door_secret', func_door_secret);
  registry.register('func_button', func_button);
  registry.register('func_train', func_train);
  registry.register('func_plat', func_plat);
  registry.register('func_plat2', func_plat2);
  registry.register('func_rotating', SP_func_rotating);
  registry.register('func_pendulum', func_pendulum);
  registry.register('func_conveyor', func_conveyor);
  registry.register('func_water', func_water);
  registry.register('func_explosive', func_explosive);
  registry.register('func_killbox', func_killbox);
  registry.register('func_areaportal', func_areaportal);
  registry.register('func_door_rotating', func_door_rotating);
  registry.register('func_timer', func_timer);
}
