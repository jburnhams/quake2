import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, lengthVec3, MASK_SHOT, angleVectors, scaleVec3, addVec3, vectorToYaw } from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  AIFlags,
  AttackState
} from '../../ai/index.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { GIB_METALLIC, throwGibs } from '../gibs.js';
import { rangeTo, RangeCategory, infront } from '../../ai/perception.js';
import { monster_fire_blaster, monster_fire_bullet, monster_fire_rocket } from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

// Helper to check if a blindfire shot is viable
function M_AdjustBlindfireTarget(self: Entity, start: Vec3, target: Vec3, right: Vec3, context: any): Vec3 | null {
  const tr = context.trace(start, target, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

  if (!tr.startsolid && !tr.allsolid && tr.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(target, start));
  }

  // Try left
  const leftTarget = addVec3(target, scaleVec3(right, -20));
  const trLeft = context.trace(start, leftTarget, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);
  if (!trLeft.startsolid && !trLeft.allsolid && trLeft.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(leftTarget, start));
  }

  // Try right
  const rightTarget = addVec3(target, scaleVec3(right, 20));
  const trRight = context.trace(start, rightTarget, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);
  if (!trRight.startsolid && !trRight.allsolid && trRight.fraction >= 0.5) {
    return normalizeVec3(subtractVec3(rightTarget, start));
  }

  return null;
}

function tank_blind_check(self: Entity, context: any): void {
  if (self.monsterinfo.aiflags & AIFlags.ManualSteering) {
    if (self.monsterinfo.blind_fire_target) {
        const aim = subtractVec3(self.monsterinfo.blind_fire_target, self.origin);
        self.ideal_yaw = vectorToYaw(aim);
    }
  }
}

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_blaster_move: MonsterMove;
let attack_machinegun_move: MonsterMove;
let attack_rocket_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function tank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function tank_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function tank_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function classifyRange(distance: number): RangeCategory {
    if (distance <= 150) return RangeCategory.Melee;
    if (distance <= 500) return RangeCategory.Near;
    if (distance <= 1000) return RangeCategory.Mid;
    return RangeCategory.Far;
}

function tank_checkattack(self: Entity, context: any): boolean {
  if (!self.enemy) return false;

  const visibleEnemy = rangeTo(self, self.enemy) <= 1000 && context.trace(self.origin, ZERO_VEC3, ZERO_VEC3, self.enemy.origin, self, MASK_SHOT).fraction === 1.0; // Simplified visibility check

  if (visibleEnemy) {
      self.monsterinfo.blind_fire_target = addVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, -0.1));
      self.monsterinfo.blind_fire_delay = 0;
  } else {
      if (self.monsterinfo.blindfire && (self.monsterinfo.blind_fire_delay || 0) <= 20.0) {
           if (self.attack_finished_time > context.timeSeconds) return false;

           if (context.timeSeconds < (self.monsterinfo.trail_time + (self.monsterinfo.blind_fire_delay || 0))) {
               return false;
           }

           if (self.monsterinfo.blind_fire_target) {
               const tr = context.trace(self.origin, ZERO_VEC3, ZERO_VEC3, self.monsterinfo.blind_fire_target, self, 0); // Check line of sight to blind target? C++ checks CONTENTS_MONSTER
               // C++: tr = gi.traceline(spot1, self->monsterinfo.blind_fire_target, self, CONTENTS_MONSTER);
               // Here just check if blocked by world? Or simplify.
               // If valid, set AS_BLIND
               self.monsterinfo.attack_state = AttackState.Blind;
               return true;
           }
      }
      return false;
  }

  // Normal attack checks
  const dist = rangeTo(self, self.enemy);

  if (self.attack_finished_time > context.timeSeconds) return false;

  let chance = 0.0;
  if (dist <= 150) chance = 0.4; // Melee
  else if (dist <= 500) chance = 0.25; // Near
  else if (dist <= 1000) chance = 0.06; // Mid
  else chance = 0.0; // Far

  if (Math.random() < chance) {
      self.monsterinfo.attack_state = AttackState.Missile;
      self.attack_finished_time = context.timeSeconds;
      return true;
  }

  return false;
}

function tank_attack(self: Entity): void {
  if (!self.enemy) return;

  // Blindfire check
  if (self.monsterinfo.attack_state === AttackState.Blind) {
      let chance = 1.0;
      if ((self.monsterinfo.blind_fire_delay || 0) < 1.0) chance = 1.0;
      else if ((self.monsterinfo.blind_fire_delay || 0) < 7.5) chance = 0.4;
      else chance = 0.1;

      if (Math.random() > chance) return;

      self.monsterinfo.blind_fire_delay = (self.monsterinfo.blind_fire_delay || 0) + 5.2 + (Math.random() * 3.0);

      if (!self.monsterinfo.blind_fire_target) return;

      // Turn on manual steering
      self.monsterinfo.aiflags |= AIFlags.ManualSteering;

      // Randomly choose between rocket and blaster
      if (Math.random() < 0.5) {
          self.monsterinfo.current_move = attack_rocket_move;
      } else {
          self.monsterinfo.current_move = attack_blaster_move;
          self.monsterinfo.nextframe = 69; // FRAME_attak108 (approximate mapping needed)
      }

      self.pain_debounce_time = self.timestamp + 5.0;
      return;
  }

  const dist = rangeTo(self, self.enemy);
  const range = classifyRange(dist);

  if (range === RangeCategory.Melee || range === RangeCategory.Near) {
      if (Math.random() < 0.4) {
          self.monsterinfo.current_move = attack_machinegun_move;
      } else {
          self.monsterinfo.current_move = attack_blaster_move;
      }
  } else if (range === RangeCategory.Mid) {
      if (Math.random() < 0.5) {
          self.monsterinfo.current_move = attack_machinegun_move;
      } else {
          self.monsterinfo.current_move = attack_rocket_move;
      }
  } else {
      self.monsterinfo.current_move = attack_rocket_move;
  }
}

function tank_fire_blaster(self: Entity, context: any): void {
   if (!self.enemy) return;

   const start: Vec3 = {
       x: self.origin.x,
       y: self.origin.y,
       z: self.origin.z + (self.viewheight || 0),
   };

   let dir: Vec3;
   const blindfire = (self.monsterinfo.aiflags & AIFlags.ManualSteering) !== 0;

   if (blindfire && self.monsterinfo.blind_fire_target) {
       const angles = self.angles;
       const { right } = angleVectors(angles);
       const target = self.monsterinfo.blind_fire_target;
       const adj = M_AdjustBlindfireTarget(self, start, target, right, context);
       if (!adj) return;
       dir = adj;
   } else {
       dir = normalizeVec3(subtractVec3(self.enemy.origin, start));
   }

   const damage = 30;
   const speed = 1000;

   monster_fire_blaster(self, start, dir, damage, speed, 0, 0, context, DamageMod.BLASTER);
}

function tank_fire_machinegun(self: Entity, context: any): void {
   if (!self.enemy) return;

   const start: Vec3 = {
       x: self.origin.x,
       y: self.origin.y,
       z: self.origin.z + (self.viewheight || 0),
   };
   const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));
   const damage = 20;
   const kick = 2;

   monster_fire_bullet(self, start, dir, damage, kick, 0.05, 0.05, 0, context, DamageMod.MACHINEGUN);
}

function tank_fire_rocket(self: Entity, context: any): void {
   if (!self.enemy) return;

   const start: Vec3 = {
       x: self.origin.x,
       y: self.origin.y,
       z: self.origin.z + (self.viewheight || 0), // Firing from shoulder
   };

   let dir: Vec3;
   const blindfire = (self.monsterinfo.aiflags & AIFlags.ManualSteering) !== 0;

   if (blindfire && self.monsterinfo.blind_fire_target) {
       const angles = self.angles;
       const { right } = angleVectors(angles);
       const target = self.monsterinfo.blind_fire_target;
       const adj = M_AdjustBlindfireTarget(self, start, target, right, context);
       if (!adj) return;
       dir = adj;
   } else {
       dir = normalizeVec3(subtractVec3(self.enemy.origin, start));
   }

   const damage = 50;
   const speed = 650;

   monster_fire_rocket(self, start, dir, damage, speed, 0, context);
}


function tank_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function tank_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function tank_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

function tank_refire_rocket(self: Entity, context: any): void {
  // Blindfire cleanup
  if (self.monsterinfo.aiflags & AIFlags.ManualSteering) {
    self.monsterinfo.aiflags &= ~AIFlags.ManualSteering;
  }
  tank_run(self);
}

// Frame definitions (approximated)
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: tank_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 16 }, () => ({
  ai: monster_ai_walk,
  dist: 5,
}));

walk_move = {
  firstframe: 30,
  lastframe: 45,
  frames: walk_frames,
  endfunc: tank_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 16 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 46,
  lastframe: 61,
  frames: run_frames,
  endfunc: tank_run,
};

// Attack 1: Blaster
const attack_blaster_frames: MonsterFrame[] = Array.from({ length: 16 }, (_, i) => {
    let think: ((self: Entity, context: any) => void) | null | undefined = null;
    if (i === 7) think = tank_blind_check;
    else if (i > 5 && i < 12) think = tank_fire_blaster;

    return {
        ai: monster_ai_charge,
        dist: 0,
        think
    };
});

attack_blaster_move = {
    firstframe: 62,
    lastframe: 77,
    frames: attack_blaster_frames,
    endfunc: tank_run
};

// Attack 2: Machinegun
const attack_machinegun_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i % 2 === 0 && i > 5) ? tank_fire_machinegun : null
}));

attack_machinegun_move = {
    firstframe: 78,
    lastframe: 97,
    frames: attack_machinegun_frames,
    endfunc: tank_run
};

// Attack 3: Rocket
const attack_rocket_frames: MonsterFrame[] = Array.from({ length: 18 }, (_, i) => {
    let think: ((self: Entity, context: any) => void) | null | undefined = null;
    if (i === 0) think = tank_blind_check;
    else if (i === 8 || i === 12 || i === 16) think = tank_fire_rocket;

    return {
        ai: monster_ai_charge,
        dist: 0,
        think
    };
});

attack_rocket_move = {
    firstframe: 98,
    lastframe: 115,
    frames: attack_rocket_frames,
    endfunc: tank_refire_rocket
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 116,
  lastframe: 121,
  frames: pain_frames,
  endfunc: tank_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 16 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 122,
  lastframe: 137,
  frames: death_frames,
  endfunc: tank_dead,
};


export function SP_monster_tank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_tank';
  self.model = 'models/monsters/tank/tris.md2';
  self.mins = { x: -32, y: -32, z: -16 };
  self.maxs = { x: 32, y: 32, z: 64 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 750;
  self.max_health = 750;
  self.mass = 500;
  self.takedamage = true;
  self.viewheight = 64; // Tank is large

  self.pain = (self, other, kick, damage) => {
    // If health is low, change skin to show damage
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    // Pain debounce
    if (self.timestamp < (self.pain_finished_time || 0)) {
        return;
    }

    self.pain_finished_time = self.timestamp + 3.0;

    // Small chance to ignore pain if not severe
    if (damage <= 10 && Math.random() < 0.5) return;

    self.monsterinfo.current_move = pain_move;
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -40) {
        throwGibs(context.entities, self.origin, damage, GIB_METALLIC);
        context.entities.free(self);
        return;
    }

    tank_die(self);
  };

  self.monsterinfo.stand = tank_stand;
  self.monsterinfo.walk = tank_walk;
  self.monsterinfo.run = tank_run;
  self.monsterinfo.attack = tank_attack;
  self.monsterinfo.attack_machinegun = attack_machinegun_move;
  self.monsterinfo.checkattack = tank_checkattack;
  self.monsterinfo.blindfire = true;

  self.think = monster_think;

  tank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerTankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_tank', SP_monster_tank);
}
