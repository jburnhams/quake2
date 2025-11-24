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
import { monster_fire_blaster, monster_fire_rocket } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
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

function makron_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function makron_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function makron_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function makron_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function makron_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Makron has BFG, Blaster, Railgun
    monster_fire_blaster(self, start, forward, 20, 1000, 0, 0, context, DamageMod.BLASTER);
}

function makron_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function makron_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function makron_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames
// Stand
const stand_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 45,
  frames: stand_frames,
  endfunc: makron_stand,
};

// Walk
const walk_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_walk,
  dist: 10,
}));

walk_move = {
  firstframe: 0,
  lastframe: 45,
  frames: walk_frames,
  endfunc: makron_walk,
};

// Run
const run_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_run,
  dist: 20,
}));

run_move = {
  firstframe: 0,
  lastframe: 45,
  frames: run_frames,
  endfunc: makron_run,
};

// Attack
const attack_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 15) ? makron_fire : null
}));

attack_move = {
    firstframe: 46,
    lastframe: 75,
    frames: attack_frames,
    endfunc: makron_run
};

// Pain
const pain_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 76,
    lastframe: 85,
    frames: pain_frames,
    endfunc: makron_run
}

// Death
const death_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 86,
    lastframe: 105,
    frames: death_frames,
    endfunc: makron_dead
}


export function SP_monster_makron(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_makron';
  self.model = 'models/monsters/boss3/rider.md2';
  self.mins = { x: -30, y: -30, z: -24 };
  self.maxs = { x: 30, y: 30, z: 90 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 1000;
  self.takedamage = true;
  self.viewheight = 70;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -80) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    makron_die(self);
  };

  self.monsterinfo.stand = makron_stand;
  self.monsterinfo.walk = makron_walk;
  self.monsterinfo.run = makron_run;
  self.monsterinfo.attack = makron_attack;

  self.think = monster_think;

  makron_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMakronSpawns(registry: SpawnRegistry): void {
  registry.register('monster_makron', SP_monster_makron);
}
