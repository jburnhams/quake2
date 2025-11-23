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
import { T_Damage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { rangeTo, infront } from '../../ai/perception.js';
import { normalizeVec3, subtractVec3, addVec3, scaleVec3, ZERO_VEC3 } from '@quake2ts/shared';

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
let attack_tentacles_move: MonsterMove;
let attack_chest_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;
let duck_move: MonsterMove;

function brain_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function brain_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function brain_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function brain_attack(self: Entity): void {
  // Randomly choose attack or based on range?
  // Original Q2 logic:
  // if (range(self, self.enemy) == RANGE_MELEE) {
  //    if (random() <= 0.5) brain_swing_left ...
  // } else {
  //    brain_chest_open ...
  // }

  // Simplified:
  if (Math.random() < 0.5) {
      self.monsterinfo.current_move = attack_tentacles_move;
  } else {
      self.monsterinfo.current_move = attack_chest_move;
  }
}

function brain_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function brain_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function brain_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

function brain_duck(self: Entity): void {
    self.monsterinfo.current_move = duck_move;
}

// Attack logic
function brain_swing(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Melee check
    const damage = 5 + Math.random() * 5; // Approx
    // Use T_Damage if in range and infront
    const dist = rangeTo(self, self.enemy);
    if (dist <= 100 && infront(self, self.enemy)) {
         T_Damage(self.enemy as any, self as any, self as any,
             normalizeVec3(subtractVec3(self.enemy.origin, self.origin)),
             self.enemy.origin, ZERO_VEC3, damage, 5, DamageFlags.NO_ARMOR, DamageMod.UNKNOWN);
    }
}

function brain_chest_laser(self: Entity, context: any): void {
    // Actually Q2 brains chest attack is also tentacle/spike related in many descriptions,
    // but code says 'brain_tentacle_attack'.
    brain_swing(self, context);
}


// Frame definitions
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: brain_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 11 }, () => ({
  ai: monster_ai_walk,
  dist: 3,
}));

walk_move = {
  firstframe: 30,
  lastframe: 40,
  frames: walk_frames,
  endfunc: brain_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 11 }, () => ({
  ai: monster_ai_run,
  dist: 6,
}));

run_move = {
  firstframe: 30, // Uses walk frames for run usually, or same sequence?
                  // Q2 often reuses frames or has separate.
                  // Assuming same frames for now but faster AI updates?
                  // Actually Q2 usually has separate run frames.
                  // Looking at `m_brain.c`: `brain_frames_run` is not defined?
                  // Wait, `m_brain.c` uses `brain_frames_walk` for run too?
                  // `mmove_t brain_move_run = {FRAME_walk1, FRAME_walk11, brain_frames_walk, brain_run};`
                  // So yes, it reuses walk frames.
  lastframe: 40,
  frames: run_frames, // Reusing definition but could be same object
  endfunc: brain_run,
};

// Duck
const duck_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));
duck_move = {
    firstframe: 41,
    lastframe: 50,
    frames: duck_frames,
    endfunc: brain_stand
}

const death_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 51,
  lastframe: 68,
  frames: death_frames,
  endfunc: brain_dead,
};

const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 69,
  lastframe: 74,
  frames: pain_frames,
  endfunc: brain_run,
};

// Attack 1
const attack_tentacles_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 10) ? brain_swing : null
}));

attack_tentacles_move = {
    firstframe: 91,
    lastframe: 110,
    frames: attack_tentacles_frames,
    endfunc: brain_run
};

// Attack 2
const attack_chest_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 15) ? brain_chest_laser : null
}));

attack_chest_move = {
    firstframe: 111,
    lastframe: 140,
    frames: attack_chest_frames,
    endfunc: brain_run
};


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
  self.viewheight = 30;

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

    brain_die(self);
  };

  self.monsterinfo.stand = brain_stand;
  self.monsterinfo.walk = brain_walk;
  self.monsterinfo.run = brain_run;
  self.monsterinfo.attack = brain_attack;

  self.think = monster_think;

  brain_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerBrainSpawns(registry: SpawnRegistry): void {
  registry.register('monster_brain', SP_monster_brain);
}
