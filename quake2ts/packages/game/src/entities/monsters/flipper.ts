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
  EntityFlags
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
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
let attack_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function flipper_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function flipper_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function flipper_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function flipper_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function flipper_bite(self: Entity, context: any): void {
    if (!self.enemy) return;
    const damage = 5 + Math.random() * 5;
    const dist = rangeTo(self, self.enemy);
    if (dist <= 60 && infront(self, self.enemy)) {
        T_Damage(self.enemy as any, self as any, self as any,
             normalizeVec3(subtractVec3(self.enemy.origin, self.origin)),
             self.enemy.origin, ZERO_VEC3, damage, 0, DamageFlags.NO_ARMOR, DamageMod.UNKNOWN);
    }
}

function flipper_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function flipper_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function flipper_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames
// Stand: 0-29
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: flipper_stand,
};

// Walk: 30-49? (Guessing standard ranges)
// Actually Flipper might just use run frames for swim
const walk_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_walk,
  dist: 5,
}));

walk_move = {
  firstframe: 30,
  lastframe: 49,
  frames: walk_frames,
  endfunc: flipper_walk,
};

// Run: 30-49 (Same as walk but faster updates?)
const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 30,
  lastframe: 49,
  frames: run_frames,
  endfunc: flipper_run,
};

// Attack: 50-69
const attack_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 10,
    think: (i === 10) ? flipper_bite : null
}));

attack_move = {
    firstframe: 50,
    lastframe: 69,
    frames: attack_frames,
    endfunc: flipper_run
};

// Pain: 70-75
const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 70,
    lastframe: 75,
    frames: pain_frames,
    endfunc: flipper_run
}

// Death: 76-85
const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 76,
    lastframe: 85,
    frames: death_frames,
    endfunc: flipper_dead
}

export function SP_monster_flipper(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_flipper';
  self.model = 'models/monsters/flipper/tris.md2';
  self.mins = { x: -24, y: -24, z: -24 };
  self.maxs = { x: 24, y: 24, z: 24 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 50;
  self.max_health = 50;
  self.mass = 100;
  self.takedamage = true;
  self.flags |= EntityFlags.Swim;
  self.viewheight = 24;

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

    flipper_die(self);
  };

  self.monsterinfo.stand = flipper_stand;
  self.monsterinfo.walk = flipper_walk;
  self.monsterinfo.run = flipper_run;
  self.monsterinfo.attack = flipper_attack;

  self.think = monster_think;

  flipper_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerFlipperSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flipper', SP_monster_flipper);
}
