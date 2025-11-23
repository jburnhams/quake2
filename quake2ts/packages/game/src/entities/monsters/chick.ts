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
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, addVec3, scaleVec3, angleVectors, vectorToAngles } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { monster_fire_rocket, monster_fire_hit } from './attack.js';

const MONSTER_TICK = 0.1;
const MELEE_DISTANCE = 80;

// Helper to access deterministic RNG or Math.random
const random = Math.random;

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
let start_attack1_move: MonsterMove;
let attack1_move: MonsterMove;
let end_attack1_move: MonsterMove;
let start_slash_move: MonsterMove;
let slash_move: MonsterMove;
let end_slash_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let duck_move: MonsterMove;

function chick_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function chick_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function chick_run(self: Entity): void {
  self.monsterinfo.current_move = run_move;
}

function chick_sight(self: Entity, other: Entity): void {
  // context is not directly available here unless bound or via entity back-reference
  // Assuming entity has engine access or context is not strictly needed for sound here
  // if the sound system is global or attached to entity.
  // For now, we skip sound or assume 'self.engine' if we had it.
}

// Attacks

function chick_slash(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: 0, z: 10 }; // approximate
  monster_fire_hit(self, aim, 10 + Math.floor(random() * 6), 100, context);
  context.engine.sound?.(self, 0, 'chick/chkatck3.wav', 1, 1, 0);
}

function chick_rocket(self: Entity, context: any): void {
  if (!self.enemy) return;

  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  const angleVecs = angleVectors(self.angles);

  // Approximate offset for rocket launcher on shoulder
  // monster_flash_offset[MZ2_CHICK_ROCKET_1]
  // We'll just use a standard offset relative to origin
  const offset = { x: 0, y: 20, z: 40 };

  const start = addVec3(self.origin, {
      x: angleVecs.forward.x * offset.x + angleVecs.right.x * offset.y + angleVecs.up.x * offset.z,
      y: angleVecs.forward.y * offset.x + angleVecs.right.y * offset.y + angleVecs.up.y * offset.z,
      z: angleVecs.forward.z * offset.x + angleVecs.right.z * offset.y + angleVecs.up.z * offset.z
  });

  const target = { ...self.enemy.origin };
  target.z += self.enemy.viewheight;

  const dir = normalizeVec3(subtractVec3(target, start));

  monster_fire_rocket(self, start, dir, 50, 500, 0, context);
}

function chick_preattack1(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'chick/chkatck1.wav', 1, 1, 0);
}

function chick_reload(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'chick/chkatck5.wav', 1, 1, 0);
}

function chick_attack1(self: Entity): void {
  self.monsterinfo.current_move = attack1_move;
}

function chick_rerocket(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
      // range check omitted, simplified
      if (random() <= 0.6) {
          self.monsterinfo.current_move = attack1_move;
          return;
      }
  }
  self.monsterinfo.current_move = end_attack1_move;
}

function chick_reslash(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
      // melee range check omitted
      if (random() <= 0.9) {
          self.monsterinfo.current_move = slash_move;
          return;
      }
  }
  self.monsterinfo.current_move = end_slash_move;
}

function chick_slash_start(self: Entity): void {
    self.monsterinfo.current_move = slash_move;
}

function chick_attack(self: Entity): void {
  self.monsterinfo.current_move = start_attack1_move;
}

function chick_melee(self: Entity): void {
  self.monsterinfo.current_move = start_slash_move;
}

// Frames

// STAND
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
stand_move = {
  firstframe: 121,
  lastframe: 150,
  frames: stand_frames,
  endfunc: chick_stand
};

// WALK
const walk_frames: MonsterFrame[] = Array.from({ length: 27 }, () => ({
  ai: monster_ai_walk,
  dist: 6 // averaged
}));
walk_move = {
  firstframe: 181,
  lastframe: 207,
  frames: walk_frames,
  endfunc: chick_walk
};

// RUN
const run_frames: MonsterFrame[] = Array.from({ length: 27 }, () => ({
  ai: monster_ai_run,
  dist: 12 // averaged
}));
run_move = {
  firstframe: 181,
  lastframe: 207,
  frames: run_frames,
  endfunc: chick_run
};

// PAIN
const pain1_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain1_move = { firstframe: 90, lastframe: 94, frames: pain1_frames, endfunc: chick_run };

const pain2_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain2_move = { firstframe: 95, lastframe: 99, frames: pain2_frames, endfunc: chick_run };

const pain3_frames: MonsterFrame[] = Array.from({ length: 21 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain3_move = { firstframe: 100, lastframe: 120, frames: pain3_frames, endfunc: chick_run };

function chick_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: any): void {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  }

  if (self.timestamp < (self.pain_debounce_time || 0)) return;

  self.pain_debounce_time = self.timestamp + 3;

  const r = random();
  if (r < 0.33) context.engine.sound?.(self, 0, 'chick/chkpain1.wav', 1, 1, 0);
  else if (r < 0.66) context.engine.sound?.(self, 0, 'chick/chkpain2.wav', 1, 1, 0);
  else context.engine.sound?.(self, 0, 'chick/chkpain3.wav', 1, 1, 0);

  if (damage <= 10) self.monsterinfo.current_move = pain1_move;
  else if (damage <= 25) self.monsterinfo.current_move = pain2_move;
  else self.monsterinfo.current_move = pain3_move;
}

// DEATH
const death1_frames: MonsterFrame[] = Array.from({ length: 12 }, () => ({ ai: monster_ai_move, dist: 0 }));
death1_move = { firstframe: 48, lastframe: 59, frames: death1_frames, endfunc: chick_dead };

const death2_frames: MonsterFrame[] = Array.from({ length: 23 }, () => ({ ai: monster_ai_move, dist: 0 }));
death2_move = { firstframe: 60, lastframe: 82, frames: death2_frames, endfunc: chick_dead };

function chick_dead(self: Entity): void {
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 16 };
  self.movetype = MoveType.Toss;
  self.nextthink = -1;
  // linkentity
}

function chick_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: any): void {
  if (self.health <= -70) { // gib_health
    context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
    throwGibs(context.entities, self.origin, damage);
    context.entities.free(self);
    return;
  }

  if (self.deadflag === DeadFlag.Dead) return;

  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;

  if (random() <= 0.5) {
    self.monsterinfo.current_move = death1_move;
    context.engine.sound?.(self, 0, 'chick/chkdeth1.wav', 1, 1, 0);
  } else {
    self.monsterinfo.current_move = death2_move;
    context.engine.sound?.(self, 0, 'chick/chkdeth2.wav', 1, 1, 0);
  }
}

// ATTACK 1 (Rocket)
const start_attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0, think: chick_preattack1 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 3 },
    { ai: monster_ai_charge, dist: 5 },
    { ai: monster_ai_charge, dist: 7 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: chick_attack1 },
];
start_attack1_move = { firstframe: 0, lastframe: 12, frames: start_attack1_frames, endfunc: null };

const attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 19, think: chick_rocket },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -5 },
    { ai: monster_ai_charge, dist: -2 },
    { ai: monster_ai_charge, dist: -7 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 10, think: chick_reload },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 5 },
    { ai: monster_ai_charge, dist: 6 },
    { ai: monster_ai_charge, dist: 6 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 3, think: chick_rerocket },
];
attack1_move = { firstframe: 13, lastframe: 26, frames: attack1_frames, endfunc: null };

const end_attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -4 },
    { ai: monster_ai_charge, dist: -2 },
];
end_attack1_move = { firstframe: 27, lastframe: 31, frames: end_attack1_frames, endfunc: chick_run };

// SLASH
const start_slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 8 },
    { ai: monster_ai_charge, dist: 3 },
];
start_slash_move = { firstframe: 32, lastframe: 34, frames: start_slash_frames, endfunc: chick_slash_start };

const slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 7, think: chick_slash },
    { ai: monster_ai_charge, dist: -7 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: -2, think: chick_reslash },
];
slash_move = { firstframe: 35, lastframe: 43, frames: slash_frames, endfunc: null };

const end_slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: 0 },
];
end_slash_move = { firstframe: 44, lastframe: 47, frames: end_slash_frames, endfunc: chick_run };

// DUCK
const duck_frames: MonsterFrame[] = Array.from({ length: 7 }, () => ({ ai: monster_ai_move, dist: 0 }));
duck_move = { firstframe: 83, lastframe: 89, frames: duck_frames, endfunc: chick_run };

function chick_dodge(self: Entity, attacker: Entity, eta: number): void {
    if (random() > 0.25) return;
    if (!self.enemy) self.enemy = attacker;
    self.monsterinfo.current_move = duck_move;
}

export function SP_monster_chick(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_chick';
  self.model = 'models/monsters/bitch/tris.md2';
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 56 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 175;
  self.max_health = 175;
  self.mass = 200;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => chick_pain(ent, other, kick, dmg, context.entities);
  self.die = (ent, infl, att, dmg, pt) => chick_die(ent, infl, att, dmg, pt, context.entities);

  self.monsterinfo.stand = chick_stand;
  self.monsterinfo.walk = chick_walk;
  self.monsterinfo.run = chick_run;
  // self.monsterinfo.dodge = chick_dodge; // Not in type definition yet
  self.monsterinfo.attack = chick_attack;
  self.monsterinfo.melee = chick_melee;
  self.monsterinfo.sight = (s, o) => {
      context.entities.sound?.(s, 0, 'chick/chksght1.wav', 1, 1, 0);
  };

  self.think = monster_think;

  context.entities.linkentity(self);

  chick_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerChickSpawns(registry: SpawnRegistry): void {
  registry.register('monster_chick', SP_monster_chick);
}
