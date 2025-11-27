import { normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
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
import { T_Damage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { throwGibs } from '../gibs.js';
import { rangeTo, RangeCategory, infront } from '../../ai/perception.js';
import { monster_fire_railgun } from './attack.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, MONSTER_TICK, context);
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
let attack_melee_move: MonsterMove;
let attack_gun_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function gladiator_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function gladiator_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function gladiator_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function classifyRange(distance: number): RangeCategory {
  if (distance <= 80) return RangeCategory.Melee;
  if (distance <= 500) return RangeCategory.Near;
  if (distance <= 1000) return RangeCategory.Mid;
  return RangeCategory.Far;
}

function gladiator_attack(self: Entity): void {
  if (!self.enemy) return;

  const dist = rangeTo(self, self.enemy);

  if (classifyRange(dist) === RangeCategory.Melee) {
      self.monsterinfo.current_move = attack_melee_move;
  } else {
      self.monsterinfo.current_move = attack_gun_move;
  }
}

function gladiator_melee(self: Entity, context: any): void {
  if (!self.enemy) return;

  if (!infront(self, self.enemy)) {
      return;
  }

  const dist = rangeTo(self, self.enemy);
  if (classifyRange(dist) !== RangeCategory.Melee) {
      return;
  }

  const start: Vec3 = {
      x: self.origin.x,
      y: self.origin.y,
      z: self.origin.z + (self.viewheight || 0),
  };
  const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

  // Cleaver attack
  T_Damage(self.enemy as any, self as any, self as any, dir, self.origin, { x: 0, y: 0, z: 0 }, 20, 10, 0, DamageMod.UNKNOWN, context.timeSeconds);
}

function gladiator_fire_railgun(self: Entity, context: any): void {
   if (!self.enemy) return;

   const start: Vec3 = {
       x: self.origin.x,
       y: self.origin.y,
       z: self.origin.z + (self.viewheight || 0),
   };
   const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));
   const damage = 50;
   const kick = 100;

   monster_fire_railgun(self, start, forward, damage, kick, 0, context);
}


function gladiator_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function gladiator_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function gladiator_dead(self: Entity): void {
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
  endfunc: gladiator_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
  ai: monster_ai_walk,
  dist: 3,
}));

walk_move = {
  firstframe: 30,
  lastframe: 69,
  frames: walk_frames,
  endfunc: gladiator_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 12,
}));

run_move = {
  firstframe: 70,
  lastframe: 89,
  frames: run_frames,
  endfunc: gladiator_run,
};

const attack_melee_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 5 ? gladiator_melee : null
}));

attack_melee_move = {
    firstframe: 90,
    lastframe: 99,
    frames: attack_melee_frames,
    endfunc: gladiator_run
};

const attack_gun_frames: MonsterFrame[] = Array.from({ length: 12 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 6 ? gladiator_fire_railgun : null
}));

attack_gun_move = {
    firstframe: 100,
    lastframe: 111,
    frames: attack_gun_frames,
    endfunc: gladiator_run
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 112,
  lastframe: 117,
  frames: pain_frames,
  endfunc: gladiator_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 12 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 118,
  lastframe: 129,
  frames: death_frames,
  endfunc: gladiator_dead,
};


export function SP_monster_gladiator(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_gladiator';
  self.model = 'models/monsters/gladiatr/tris.md2';
  self.mins = { x: -32, y: -32, z: -24 };
  self.maxs = { x: 32, y: 32, z: 64 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 400;
  self.max_health = 400;
  self.mass = 400;
  self.takedamage = true;
  self.viewheight = 40; // Gladiator viewheight

  self.pain = (self, other, kick, damage) => {
    // Cast to any for interface compatibility
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -40) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    gladiator_die(self);
  };

  self.monsterinfo.stand = gladiator_stand;
  self.monsterinfo.walk = gladiator_walk;
  self.monsterinfo.run = gladiator_run;
  self.monsterinfo.attack = gladiator_attack;

  self.think = monster_think;

  gladiator_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerGladiatorSpawns(registry: SpawnRegistry): void {
  registry.register('monster_gladiator', SP_monster_gladiator);
}
