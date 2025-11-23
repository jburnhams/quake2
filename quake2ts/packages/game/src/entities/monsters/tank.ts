import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, lengthVec3 } from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
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
import { throwGibs } from '../gibs.js';
import { rangeTo, RangeCategory, infront } from '../../ai/perception.js';
import { monster_fire_blaster, monster_fire_bullet, monster_fire_rocket } from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
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

function tank_attack(self: Entity): void {
  if (!self.enemy) return;

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
   const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));
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
   const damage = 10;
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
   const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));
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
const attack_blaster_frames: MonsterFrame[] = Array.from({ length: 16 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i > 5 && i < 12) ? tank_fire_blaster : null // Rapid fire blaster
}));

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
const attack_rocket_frames: MonsterFrame[] = Array.from({ length: 18 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 8 ? tank_fire_rocket : (i === 12 ? tank_fire_rocket : (i === 16 ? tank_fire_rocket : null)) // Burst of 3
}));

attack_rocket_move = {
    firstframe: 98,
    lastframe: 115,
    frames: attack_rocket_frames,
    endfunc: tank_run
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
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    tank_die(self);
  };

  self.monsterinfo.stand = tank_stand;
  self.monsterinfo.walk = tank_walk;
  self.monsterinfo.run = tank_run;
  self.monsterinfo.attack = tank_attack;

  self.think = monster_think;

  tank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerTankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_tank', SP_monster_tank);
}
