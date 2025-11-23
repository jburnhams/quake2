import { angleVectors, normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
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

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
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
let attack_punch_move: MonsterMove;
let attack_slash_move: MonsterMove;
let attack_smash_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function berserk_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function berserk_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function berserk_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function berserk_attack(self: Entity): void {
  // Randomly choose an attack, potentially weighted by distance or RNG
  const r = Math.random();
  if (r < 0.33) {
    self.monsterinfo.current_move = attack_punch_move;
  } else if (r < 0.66) {
    self.monsterinfo.current_move = attack_slash_move;
  } else {
    self.monsterinfo.current_move = attack_smash_move;
  }
}

function berserk_swing(self: Entity, damage: number, context: any): void {
  if (!self.enemy) return;

  if (!infront(self, self.enemy)) {
      return;
  }

  const dist = rangeTo(self, self.enemy);
  if (classifyRange(dist) !== RangeCategory.Melee) {
      return;
  }

  // Calculate direction
  const start: Vec3 = {
      x: self.origin.x,
      y: self.origin.y,
      z: self.origin.z + self.viewheight,
  };
  const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

  // Inflict damage
  // Use 'any' cast to satisfy T_Damage/Damageable interface mismatch
  T_Damage(self.enemy as any, self as any, self as any, dir, self.origin, { x: 0, y: 0, z: 0 }, damage, 5, 0, DamageMod.UNKNOWN);
}

// Helper to classify range inside the module if not imported
function classifyRange(distance: number): RangeCategory {
  if (distance <= 80) return RangeCategory.Melee; // Approximated
  if (distance <= 500) return RangeCategory.Near;
  if (distance <= 1000) return RangeCategory.Mid;
  return RangeCategory.Far;
}


function berserk_punch(self: Entity, context: any): void {
  berserk_swing(self, 10, context);
}

function berserk_slash(self: Entity, context: any): void {
  berserk_swing(self, 15, context);
}

function berserk_smash(self: Entity, context: any): void {
    berserk_swing(self, 20, context);
}

function berserk_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function berserk_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function berserk_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frame definitions (approximated frame counts)
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: berserk_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
  ai: monster_ai_walk,
  dist: 4,
}));

walk_move = {
  firstframe: 30,
  lastframe: 69,
  frames: walk_frames,
  endfunc: berserk_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 15,
}));

run_move = {
  firstframe: 70,
  lastframe: 89,
  frames: run_frames,
  endfunc: berserk_run,
};

const attack_punch_frames: MonsterFrame[] = Array.from({ length: 8 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 4 ? berserk_punch : null
}));

attack_punch_move = {
    firstframe: 90,
    lastframe: 97,
    frames: attack_punch_frames,
    endfunc: berserk_run
};

const attack_slash_frames: MonsterFrame[] = Array.from({ length: 8 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 4 ? berserk_slash : null
}));

attack_slash_move = {
    firstframe: 98,
    lastframe: 105,
    frames: attack_slash_frames,
    endfunc: berserk_run
};

const attack_smash_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 6 ? berserk_smash : null
}));

attack_smash_move = {
    firstframe: 106,
    lastframe: 115,
    frames: attack_smash_frames,
    endfunc: berserk_run
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 116,
  lastframe: 121,
  frames: pain_frames,
  endfunc: berserk_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 122,
  lastframe: 131,
  frames: death_frames,
  endfunc: berserk_dead,
};

export function SP_monster_berserk(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_berserk';
  self.model = 'models/monsters/berserk/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 240;
  self.max_health = 240;
  self.mass = 250;
  self.takedamage = true;

  self.pain = (self, other, kick, damage) => {
    // Cast to any to avoid strict interface mismatch with Entity vs Damageable
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

    berserk_die(self);
  };

  self.monsterinfo.stand = berserk_stand;
  self.monsterinfo.walk = berserk_walk;
  self.monsterinfo.run = berserk_run;
  self.monsterinfo.attack = berserk_attack;

  self.think = monster_think;

  berserk_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerBerserkSpawns(registry: SpawnRegistry): void {
  registry.register('monster_berserk', SP_monster_berserk);
}
