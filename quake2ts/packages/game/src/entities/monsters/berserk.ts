import {
  angleVectors,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  lengthVec3,
  addVec3,
  scaleVec3
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  rangeTo,
  RangeCategory,
  infront
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
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import type { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
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
  const r = Math.random();
  if (r < 0.33) {
    self.monsterinfo.current_move = attack_punch_move;
  } else if (r < 0.66) {
    self.monsterinfo.current_move = attack_slash_move;
  } else {
    self.monsterinfo.current_move = attack_smash_move;
  }
}

function berserk_swing(self: Entity, context: EntitySystem, damage: number, kick: number): void {
  if (!self.enemy) return;

  if (!self.enemy.inUse || self.enemy.health <= 0) return;

  // Check if enemy is in melee range
  // Original uses M_damage which checks range and infront
  // We can approximate range check with distance
  const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
  if (dist > 100) return; // Approximate melee range + size

  // Check if infront
  if (!infront(self, self.enemy)) return;

  // Apply damage
  // Original: M_damage(self, self->enemy, damage, kick);
  const dir = normalizeVec3(subtractVec3(self.enemy.origin, self.origin));

  T_Damage(
    self.enemy as unknown as Damageable,
    self as unknown as Damageable,
    self as unknown as Damageable,
    dir,
    self.enemy.origin,
    ZERO_VEC3,
    damage,
    kick,
    0,
    DamageMod.UNKNOWN // Should be specific melee mod?
  );
}

function berserk_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function berserk_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

// Frames

// Stand: 0-4
const stand_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 4,
  frames: stand_frames,
  endfunc: berserk_stand,
};

// Walk: 5-17
const walk_frames: MonsterFrame[] = Array.from({ length: 13 }, () => ({
  ai: monster_ai_walk,
  dist: 9, // Tuned for speed
}));

walk_move = {
  firstframe: 5,
  lastframe: 17,
  frames: walk_frames,
  endfunc: berserk_walk,
};

// Run: 18-23
const run_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_run,
  dist: 18, // Faster than walk
}));

run_move = {
  firstframe: 18,
  lastframe: 23,
  frames: run_frames,
  endfunc: berserk_run,
};

// Attack Punch: 24-30. Hit at 27 (frame index 3 relative to start)
const attack_punch_frames: MonsterFrame[] = Array.from({ length: 7 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: (i === 3) ? (self, context) => {
    berserk_swing(self, context, 10 + Math.random() * 10, 5);
  } : null
}));

attack_punch_move = {
  firstframe: 24,
  lastframe: 30,
  frames: attack_punch_frames,
  endfunc: berserk_run,
};

// Attack Slash: 31-41. Hit at 33 (frame index 2 relative to start)
const attack_slash_frames: MonsterFrame[] = Array.from({ length: 11 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: (i === 2) ? (self, context) => {
    berserk_swing(self, context, 15 + Math.random() * 10, 5);
  } : null
}));

attack_slash_move = {
  firstframe: 31,
  lastframe: 41,
  frames: attack_slash_frames,
  endfunc: berserk_run,
};

// Attack Smash: 42-50. Hit at 46 (frame index 4 relative to start)
const attack_smash_frames: MonsterFrame[] = Array.from({ length: 9 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: (i === 4) ? (self, context) => {
    berserk_swing(self, context, 20 + Math.random() * 10, 10);
  } : null
}));

attack_smash_move = {
  firstframe: 42,
  lastframe: 50,
  frames: attack_smash_frames,
  endfunc: berserk_run,
};

// Pain: 51-54
const pain_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 51,
  lastframe: 54,
  frames: pain_frames,
  endfunc: berserk_run,
};

// Death: 55-67
const death_frames: MonsterFrame[] = Array.from({ length: 13 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

function berserk_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

death_move = {
  firstframe: 55,
  lastframe: 67,
  frames: death_frames,
  endfunc: berserk_dead,
};

export function SP_monster_berserk(self: Entity, context: SpawnContext): void {
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
