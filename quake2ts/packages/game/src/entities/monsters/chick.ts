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
import { monster_fire_rocket } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { rangeTo, infront } from '../../ai/perception.js';
import { T_Damage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

// Wrappers
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
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
let attack_rocket_move: MonsterMove;
let attack_slash_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function chick_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function chick_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function chick_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function chick_attack(self: Entity): void {
  // Choose attack based on range
  if (!self.enemy) return;
  const dist = rangeTo(self, self.enemy);

  if (dist < 100 && infront(self, self.enemy) && Math.random() < 0.7) {
      self.monsterinfo.current_move = attack_slash_move;
  } else {
      self.monsterinfo.current_move = attack_rocket_move;
  }
}

function chick_fire_rocket(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_rocket(self, start, forward, 50, 650, 0, context);
}

function chick_slash(self: Entity, context: any): void {
    if (!self.enemy) return;
    const damage = 10 + Math.random() * 5;
    const dist = rangeTo(self, self.enemy);
    if (dist <= 100 && infront(self, self.enemy)) {
        T_Damage(self.enemy as any, self as any, self as any,
             normalizeVec3(subtractVec3(self.enemy.origin, self.origin)),
             self.enemy.origin, ZERO_VEC3, damage, 10, DamageFlags.NO_ARMOR, DamageMod.UNKNOWN);
    }
}


function chick_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function chick_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function chick_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: chick_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 11 }, () => ({
  ai: monster_ai_walk,
  dist: 6,
}));

walk_move = {
  firstframe: 30,
  lastframe: 40,
  frames: walk_frames,
  endfunc: chick_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 11 }, () => ({
  ai: monster_ai_run,
  dist: 12,
}));

run_move = {
  firstframe: 41,
  lastframe: 51,
  frames: run_frames,
  endfunc: chick_run,
};

const attack_rocket_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 10) ? chick_fire_rocket : null
}));

attack_rocket_move = {
    firstframe: 52,
    lastframe: 71,
    frames: attack_rocket_frames,
    endfunc: chick_run
};

const attack_slash_frames: MonsterFrame[] = Array.from({ length: 15 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 5,
    think: (i === 8) ? chick_slash : null
}));

attack_slash_move = {
    firstframe: 72,
    lastframe: 86,
    frames: attack_slash_frames,
    endfunc: chick_run
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 87,
    lastframe: 92,
    frames: pain_frames,
    endfunc: chick_run
}

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 93,
    lastframe: 102,
    frames: death_frames,
    endfunc: chick_dead
}


export function SP_monster_chick(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_chick';
  self.model = 'models/monsters/bitch/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 175;
  self.max_health = 175;
  self.mass = 200;
  self.takedamage = true;
  self.viewheight = 32;

  self.pain = (self, other, kick, damage) => {
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

    chick_die(self);
  };

  self.monsterinfo.stand = chick_stand;
  self.monsterinfo.walk = chick_walk;
  self.monsterinfo.run = chick_run;
  self.monsterinfo.attack = chick_attack;

  self.think = monster_think;

  chick_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerChickSpawns(registry: SpawnRegistry): void {
  registry.register('monster_chick', SP_monster_chick);
}
