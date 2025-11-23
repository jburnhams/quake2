import { angleVectors, normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext } from '../spawn.js';
import { SpawnRegistry } from '../spawn.js';
import { monster_fire_bullet } from './attack.js';
import { throwGibs } from '../gibs.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions to match AIAction signature (self, dist)
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, MONSTER_TICK);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, MONSTER_TICK);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist, MONSTER_TICK, context);
}

// Forward declarations for moves
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function soldier_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function soldier_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function soldier_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function soldier_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function soldier_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function soldier_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function soldier_fire(self: Entity, context: any): void {
  // soldier_fire logic
  if (!self.enemy) return;

  const start: Vec3 = {
    x: self.origin.x,
    y: self.origin.y,
    z: self.origin.z + self.viewheight,
  };

  const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));
  const damage = 4;
  const kick = 4;

  // fire bullet
  monster_fire_bullet(self, start, forward, damage, kick, 0, 0, 0, context, DamageMod.MACHINEGUN);
}

// Define moves
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: soldier_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
  ai: monster_ai_walk,
  dist: 2,
}));

walk_move = {
  firstframe: 30,
  lastframe: 69,
  frames: walk_frames,
  endfunc: soldier_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 70,
  lastframe: 89,
  frames: run_frames,
  endfunc: soldier_run,
};

const attack_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: i === 5 ? soldier_fire : null,
}));

attack_move = {
  firstframe: 90,
  lastframe: 99,
  frames: attack_frames,
  endfunc: soldier_run,
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 100,
  lastframe: 105,
  frames: pain_frames,
  endfunc: soldier_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

// End of death animation - stay on last frame
function soldier_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1; // Stop thinking
}

death_move = {
  firstframe: 106,
  lastframe: 115,
  frames: death_frames,
  endfunc: soldier_dead,
};


function SP_monster_soldier(self: Entity, context: SpawnContext): void {
  self.model = 'models/monsters/soldier/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 20;
  self.max_health = 20;
  self.mass = 100;
  self.takedamage = true;

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

    soldier_die(self);
  };

  self.monsterinfo.stand = soldier_stand;
  self.monsterinfo.walk = soldier_walk;
  self.monsterinfo.run = soldier_run;
  self.monsterinfo.attack = soldier_attack;

  self.think = monster_think;

  soldier_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMonsterSpawns(registry: SpawnRegistry): void {
  registry.register('monster_soldier', SP_monster_soldier);
}
