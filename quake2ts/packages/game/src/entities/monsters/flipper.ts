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
  EntityFlags,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { Vec3, normalizeVec3, subtractVec3, addVec3, scaleVec3, ZERO_VEC3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { monster_fire_hit } from './attack.js';

const MONSTER_TICK = 0.1;
const MELEE_DISTANCE = 80;
const FLIPPER_RUN_SPEED = 24;

// Helper to access deterministic RNG or Math.random
const random = Math.random;

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
let run_start_move: MonsterMove;
let run_loop_move: MonsterMove;
let attack_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let death_move: MonsterMove;

function flipper_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function flipper_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function flipper_run_loop(self: Entity): void {
  self.monsterinfo.current_move = run_loop_move;
}

function flipper_run(self: Entity): void {
  self.monsterinfo.current_move = run_start_move;
}

function flipper_start_run(self: Entity): void {
  self.monsterinfo.current_move = run_start_move; // Reusing run_start logic
}

function flipper_bite(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: 0, z: 0 };
  monster_fire_hit(self, aim, 5, 0, context);
}

function flipper_preattack(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'flipper/flpatck1.wav', 1, 1, 0);
}

function flipper_melee(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

// Frames

// STAND
const stand_frames: MonsterFrame[] = [
  { ai: monster_ai_stand, dist: 0 }
];
stand_move = {
  firstframe: 41,
  lastframe: 41,
  frames: stand_frames,
  endfunc: null
};

// RUN
const run_loop_frames: MonsterFrame[] = Array.from({ length: 24 }, () => ({
  ai: monster_ai_run,
  dist: FLIPPER_RUN_SPEED
}));
run_loop_move = {
  firstframe: 70,
  lastframe: 93,
  frames: run_loop_frames,
  endfunc: null // loops
};

const run_start_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_run,
  dist: 8
}));
run_start_move = {
  firstframe: 65,
  lastframe: 70,
  frames: run_start_frames,
  endfunc: flipper_run_loop
};

// WALK
const walk_frames: MonsterFrame[] = Array.from({ length: 24 }, () => ({
  ai: monster_ai_walk,
  dist: 4
}));
walk_move = {
  firstframe: 41,
  lastframe: 64,
  frames: walk_frames,
  endfunc: null
};

// PAIN
const pain1_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain1_move = {
  firstframe: 99,
  lastframe: 103,
  frames: pain1_frames,
  endfunc: flipper_run
};

const pain2_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain2_move = {
  firstframe: 94,
  lastframe: 98,
  frames: pain2_frames,
  endfunc: flipper_run
};

function flipper_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: any): void {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  }

  if (self.timestamp < (self.pain_debounce_time || 0)) {
    return;
  }

  self.pain_debounce_time = self.timestamp + 3;

  if (random() < 0.5) {
    context.engine.sound?.(self, 0, 'flipper/flppain1.wav', 1, 1, 0);
    self.monsterinfo.current_move = pain1_move;
  } else {
    context.engine.sound?.(self, 0, 'flipper/flppain2.wav', 1, 1, 0);
    self.monsterinfo.current_move = pain2_move;
  }
}

// ATTACK
const attack_frames: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 0, think: flipper_preattack },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: flipper_bite },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: flipper_bite },
  { ai: monster_ai_charge, dist: 0 },
];
attack_move = {
  firstframe: 0,
  lastframe: 19,
  frames: attack_frames,
  endfunc: flipper_run
};

// DEATH
function flipper_dead(self: Entity): void {
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: -8 };
  self.movetype = MoveType.Toss;
  self.nextthink = -1;
}

const death_frames: MonsterFrame[] = Array.from({ length: 56 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
death_move = {
  firstframe: 104,
  lastframe: 159,
  frames: death_frames,
  endfunc: flipper_dead
};

function flipper_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: any): void {
  if (self.health <= -30) { // gib_health
    context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
    throwGibs(context.entities, self.origin, damage);
    context.entities.free(self);
    return;
  }

  if (self.deadflag === DeadFlag.Dead) return;

  context.engine.sound?.(self, 0, 'flipper/flpdeth1.wav', 1, 1, 0);
  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;
  self.monsterinfo.current_move = death_move;
}

function flipper_set_fly_parameters(self: Entity): void {
    self.monsterinfo.fly_thrusters = false;
    self.monsterinfo.fly_acceleration = 30;
    self.monsterinfo.fly_speed = 110;
    self.monsterinfo.fly_min_distance = 10;
    self.monsterinfo.fly_max_distance = 10;
}


export function SP_monster_flipper(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_flipper';
  self.model = 'models/monsters/flipper/tris.md2';
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Fly; // Use Fly for swimming/flying in Q2TS
  self.flags |= EntityFlags.Swim;
  self.solid = Solid.BoundingBox;
  self.health = 50;
  self.max_health = 50;
  self.mass = 100;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => flipper_pain(ent, other, kick, dmg, context.entities);
  self.die = (ent, infl, att, dmg, pt) => flipper_die(ent, infl, att, dmg, pt, context.entities);

  self.monsterinfo.stand = flipper_stand;
  self.monsterinfo.walk = flipper_walk;
  self.monsterinfo.run = flipper_start_run;
  self.monsterinfo.melee = flipper_melee;
  self.monsterinfo.sight = (s, o) => {
      context.entities.sound?.(s, 0, 'flipper/flpsght1.wav', 1, 1, 0);
  };
  self.monsterinfo.setskin = (s) => {
      if (s.health < s.max_health / 2) s.skin = 1;
      else s.skin = 0;
  }

  self.think = monster_think;

  flipper_set_fly_parameters(self);

  context.entities.linkentity(self);

  flipper_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerFlipperSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flipper', SP_monster_flipper);
}
