import {
  ai_charge,
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
import { SpawnContext } from '../spawn.js';
import { SpawnRegistry } from '../spawn.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions to match AIAction signature (self, dist)
function monster_ai_stand(self: Entity, dist: number): void {
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number): void {
  ai_walk(self, dist, MONSTER_TICK);
}

function monster_ai_run(self: Entity, dist: number): void {
  ai_run(self, dist, MONSTER_TICK);
}

function monster_ai_charge(self: Entity, dist: number): void {
  ai_charge(self, dist, MONSTER_TICK);
}

// Forward declarations for moves
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;

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

function soldier_fire(self: Entity): void {
    // Actual firing logic placeholder
    // if (visible(self, self.enemy)) ...
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

function SP_monster_soldier(self: Entity, context: SpawnContext): void {
  self.model = 'models/monsters/soldier/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 20;
  self.max_health = 20;
  self.mass = 100;

  self.pain = (self, other, kick, damage) => {
    // Pain logic
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;
    // Trigger death animation
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
