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
import { Vec3, normalizeVec3, subtractVec3, addVec3, scaleVec3, ZERO_VEC3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { monster_fire_hit } from './attack.js';

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
let idle_move: MonsterMove;
let walk1_move: MonsterMove;
let run_move: MonsterMove;
let attack1_move: MonsterMove;
let attack2_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let duck_move: MonsterMove;
let defense_move: MonsterMove;

function brain_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function brain_idle(self: Entity): void {
  // context.engine.sound(self, 0, 'brain/brnlens1.wav', 1, 1, 0); // Need context in idle...
  self.monsterinfo.current_move = idle_move;
}

function brain_walk(self: Entity): void {
  self.monsterinfo.current_move = walk1_move;
}

function brain_run(self: Entity): void {
  // self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN (Not in our types yet)
  if (self.monsterinfo.aiflags & 4) { // AI_STAND_GROUND
    self.monsterinfo.current_move = stand_move;
  } else {
    self.monsterinfo.current_move = run_move;
  }
}

// Melee actions
function brain_swing_right(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'brain/melee1.wav', 1, 1, 0);
}

function brain_hit_right(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: self.maxs.x, z: 8 };
  if (monster_fire_hit(self, aim, 15 + Math.floor(random() * 5), 40, context)) {
    context.engine.sound?.(self, 0, 'brain/melee3.wav', 1, 1, 0);
  }
}

function brain_swing_left(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'brain/melee2.wav', 1, 1, 0);
}

function brain_hit_left(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: self.mins.x, z: 8 };
  if (monster_fire_hit(self, aim, 15 + Math.floor(random() * 5), 40, context)) {
    context.engine.sound?.(self, 0, 'brain/melee3.wav', 1, 1, 0);
  }
}

function brain_chest_open(self: Entity, context: any): void {
  self.spawnflags &= ~65536;
  // self.monsterinfo.power_armor_type = 0; // POWER_ARMOR_NONE
  context.engine.sound?.(self, 0, 'brain/brnatck1.wav', 1, 1, 0);
}

function brain_tentacle_attack(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: 0, z: 8 };
  // skill check omitted for now
  if (monster_fire_hit(self, aim, 10 + Math.floor(random() * 5), -600, context)) {
    self.spawnflags |= 65536;
  }
  context.engine.sound?.(self, 0, 'brain/brnatck3.wav', 1, 1, 0);
}

function brain_chest_closed(self: Entity): void {
  // self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN
  if (self.spawnflags & 65536) {
    self.spawnflags &= ~65536;
    self.monsterinfo.current_move = attack1_move;
  }
}

function brain_melee(self: Entity): void {
  if (random() <= 0.5) {
    self.monsterinfo.current_move = attack1_move;
  } else {
    self.monsterinfo.current_move = attack2_move;
  }
}

function brain_sight(self: Entity, other: Entity): void {
  // Sound handled by engine/game glue usually, but can be explicit here if context available
}

// Duck/Dodge
function brain_duck_down(self: Entity): void {
  if (self.monsterinfo.aiflags & 16) return; // AI_DUCKED
  self.monsterinfo.aiflags |= 16;
  // self.maxs.z -= 32; // Readonly property error, workaround needed if we want to change bbox dynamically
  // For now, we assume fixed bbox or use a method to update it if available.
  // self.maxs = { ...self.maxs, z: self.maxs.z - 32 };
  // gi.linkentity(self);
}

function brain_duck_hold(self: Entity): void {
  // if (level.time >= self.monsterinfo.pausetime) ...
  // Simplifying for now
}

function brain_duck_up(self: Entity): void {
  self.monsterinfo.aiflags &= ~16;
  // self.maxs.z += 32;
  // self.maxs = { ...self.maxs, z: self.maxs.z + 32 };
  // gi.linkentity(self);
}

function brain_dodge(self: Entity, attacker: Entity, eta: number): void {
  if (random() > 0.25) return;
  if (!self.enemy) self.enemy = attacker;
  self.monsterinfo.pausetime = self.timestamp + eta + 0.5;
  self.monsterinfo.current_move = duck_move;
}


// Frames

// STAND
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
stand_move = {
  firstframe: 162,
  lastframe: 191,
  frames: stand_frames,
  endfunc: brain_stand
};

// IDLE
const idle_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
idle_move = {
  firstframe: 192,
  lastframe: 221,
  frames: idle_frames,
  endfunc: brain_stand
};

// WALK1
const walk1_frames: MonsterFrame[] = [
  { ai: monster_ai_walk, dist: 7 },
  { ai: monster_ai_walk, dist: 2 },
  { ai: monster_ai_walk, dist: 3 },
  { ai: monster_ai_walk, dist: 3 },
  { ai: monster_ai_walk, dist: 1 },
  { ai: monster_ai_walk, dist: 0 },
  { ai: monster_ai_walk, dist: 0 },
  { ai: monster_ai_walk, dist: 9 },
  { ai: monster_ai_walk, dist: -4 },
  { ai: monster_ai_walk, dist: -1 },
  { ai: monster_ai_walk, dist: 2 },
];
walk1_move = {
  firstframe: 0,
  lastframe: 10,
  frames: walk1_frames,
  endfunc: null // Loops
};

// RUN
const run_frames: MonsterFrame[] = [
  { ai: monster_ai_run, dist: 9 },
  { ai: monster_ai_run, dist: 2 },
  { ai: monster_ai_run, dist: 3 },
  { ai: monster_ai_run, dist: 3 },
  { ai: monster_ai_run, dist: 1 },
  { ai: monster_ai_run, dist: 0 },
  { ai: monster_ai_run, dist: 0 },
  { ai: monster_ai_run, dist: 10 },
  { ai: monster_ai_run, dist: -4 },
  { ai: monster_ai_run, dist: -1 },
  { ai: monster_ai_run, dist: 2 },
];
run_move = {
  firstframe: 0,
  lastframe: 10,
  frames: run_frames,
  endfunc: null // Loops
};

// ATTACK1
const attack1_frames: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 8 },
  { ai: monster_ai_charge, dist: 3 },
  { ai: monster_ai_charge, dist: 5 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: -3, think: brain_swing_right },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: -5 },
  { ai: monster_ai_charge, dist: -7, think: brain_hit_right },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 6, think: brain_swing_left },
  { ai: monster_ai_charge, dist: 1 },
  { ai: monster_ai_charge, dist: 2, think: brain_hit_left },
  { ai: monster_ai_charge, dist: -3 },
  { ai: monster_ai_charge, dist: 6 },
  { ai: monster_ai_charge, dist: -1 },
  { ai: monster_ai_charge, dist: -3 },
  { ai: monster_ai_charge, dist: 2 },
  { ai: monster_ai_charge, dist: -11 },
];
attack1_move = {
  firstframe: 53,
  lastframe: 70,
  frames: attack1_frames,
  endfunc: brain_run
};

// ATTACK2
const attack2_frames: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 5 },
  { ai: monster_ai_charge, dist: -4 },
  { ai: monster_ai_charge, dist: -4 },
  { ai: monster_ai_charge, dist: -3 },
  { ai: monster_ai_charge, dist: 0, think: brain_chest_open },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 13, think: brain_tentacle_attack },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 2 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: -9, think: brain_chest_closed },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 4 },
  { ai: monster_ai_charge, dist: 3 },
  { ai: monster_ai_charge, dist: 2 },
  { ai: monster_ai_charge, dist: -3 },
  { ai: monster_ai_charge, dist: -6 },
];
attack2_move = {
  firstframe: 71,
  lastframe: 87,
  frames: attack2_frames,
  endfunc: brain_run
};

// PAIN
const pain1_frames: MonsterFrame[] = [
  { ai: monster_ai_move, dist: -6 },
  { ai: monster_ai_move, dist: -2 },
  { ai: monster_ai_move, dist: -6 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 2 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 2 },
  { ai: monster_ai_move, dist: 1 },
  { ai: monster_ai_move, dist: 7 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 3 },
  { ai: monster_ai_move, dist: -1 },
];
pain1_move = {
  firstframe: 88,
  lastframe: 108,
  frames: pain1_frames,
  endfunc: brain_run
};

const pain2_frames: MonsterFrame[] = [
  { ai: monster_ai_move, dist: -2 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 3 },
  { ai: monster_ai_move, dist: 1 },
  { ai: monster_ai_move, dist: -2 },
];
pain2_move = {
  firstframe: 109,
  lastframe: 116,
  frames: pain2_frames,
  endfunc: brain_run
};

const pain3_frames: MonsterFrame[] = [
  { ai: monster_ai_move, dist: -2 },
  { ai: monster_ai_move, dist: 2 },
  { ai: monster_ai_move, dist: 1 },
  { ai: monster_ai_move, dist: 3 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: -4 },
];
pain3_move = {
  firstframe: 117,
  lastframe: 122,
  frames: pain3_frames,
  endfunc: brain_run
};

// DEATH
const death1_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
death1_move = {
  firstframe: 123,
  lastframe: 140,
  frames: death1_frames,
  endfunc: brain_dead
};

const death2_frames: MonsterFrame[] = [
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 9 },
  { ai: monster_ai_move, dist: 0 },
];
death2_move = {
  firstframe: 141,
  lastframe: 145,
  frames: death2_frames,
  endfunc: brain_dead
};

// DUCK
const duck_frames: MonsterFrame[] = [
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: -2, think: brain_duck_down },
  { ai: monster_ai_move, dist: 17, think: brain_duck_hold },
  { ai: monster_ai_move, dist: -3 },
  { ai: monster_ai_move, dist: -1, think: brain_duck_up },
  { ai: monster_ai_move, dist: -5 },
  { ai: monster_ai_move, dist: -6 },
  { ai: monster_ai_move, dist: -6 },
];
duck_move = {
  firstframe: 146,
  lastframe: 153,
  frames: duck_frames,
  endfunc: brain_run
};

function brain_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: any): void {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  }

  if (self.timestamp < (self.pain_debounce_time || 0)) {
    return;
  }

  self.pain_debounce_time = self.timestamp + 3;

  const r = random();
  if (r < 0.33) {
    context.engine.sound?.(self, 0, 'brain/brnpain1.wav', 1, 1, 0);
    self.monsterinfo.current_move = pain1_move;
  } else if (r < 0.66) {
    context.engine.sound?.(self, 0, 'brain/brnpain2.wav', 1, 1, 0);
    self.monsterinfo.current_move = pain2_move;
  } else {
    context.engine.sound?.(self, 0, 'brain/brnpain1.wav', 1, 1, 0);
    self.monsterinfo.current_move = pain3_move;
  }
}

function brain_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: any): void {
  // self.monsterinfo.power_armor_type = 0; // NONE

  if (self.health <= -150) { // gib_health
    context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
    throwGibs(context.entities, self.origin, damage);
    context.entities.free(self);
    return;
  }

  if (self.deadflag === DeadFlag.Dead) return;

  context.engine.sound?.(self, 0, 'brain/brndeth1.wav', 1, 1, 0);
  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;

  if (random() <= 0.5) {
    self.monsterinfo.current_move = death1_move;
  } else {
    self.monsterinfo.current_move = death2_move;
  }
}

function brain_dead(self: Entity): void {
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: -8 };
  self.movetype = MoveType.Toss;
  self.nextthink = -1;
  // linkentity handled by system
}

export function SP_monster_brain(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_brain';
  self.model = 'models/monsters/brain/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 300;
  self.max_health = 300;
  self.mass = 400;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => brain_pain(ent, other, kick, dmg, context.entities);
  self.die = (ent, infl, att, dmg, pt) => brain_die(ent, infl, att, dmg, pt, context.entities);

  self.monsterinfo.stand = brain_stand;
  self.monsterinfo.walk = brain_walk;
  self.monsterinfo.run = brain_run;
  // self.monsterinfo.dodge = brain_dodge; // Not currently in MonsterInfo
  self.monsterinfo.attack = brain_melee; // Brain uses melee as primary attack
  self.monsterinfo.melee = brain_melee;
  self.monsterinfo.sight = (s, o) => {
      context.entities.sound?.(s, 2, 'brain/brnsght1.wav', 1, 1, 0);
  };
  self.monsterinfo.search = (s) => {
    if (random() < 0.5) {
      context.entities.sound?.(s, 2, 'brain/brnidle2.wav', 1, 1, 0);
    } else {
      context.entities.sound?.(s, 2, 'brain/brnsrch1.wav', 1, 1, 0);
    }
  };
  self.monsterinfo.idle = brain_idle;

  // self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN
  // self.monsterinfo.power_armor_power = 100;

  self.think = monster_think;

  brain_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerBrainSpawns(registry: SpawnRegistry): void {
  registry.register('monster_brain', SP_monster_brain);
}
