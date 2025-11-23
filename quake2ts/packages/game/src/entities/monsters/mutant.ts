import { normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
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
import { rangeTo, infront } from '../../ai/perception.js';

const MONSTER_TICK = 0.1;

// Wrappers for AI functions
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
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
let jump_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function mutant_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function mutant_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function mutant_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function mutant_checkattack(self: Entity): boolean {
    if (!self.enemy) return false;

    const dist = rangeTo(self, self.enemy);

    if (dist < 80) {
        self.monsterinfo.current_move = attack_move;
        return true;
    }

    if (dist < 500 && Math.random() < 0.3) {
        self.monsterinfo.current_move = jump_move;
        return true;
    }

    return false;
}

function mutant_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function mutant_jump(self: Entity, context: any): void {
    if (!self.enemy) return;

    const dir = normalizeVec3(subtractVec3(self.enemy.origin, self.origin));

    // Simple physics jump approximation
    const speed = 600;
    self.velocity = {
      x: dir.x * speed,
      y: dir.y * speed,
      z: 300, // Jump up
    };

    // Set movetype to Toss to allow physics engine to handle arc
    // But standard AI uses Step. We might need to temporarily switch or handle via special AI func.
    // In Quake 2, standard monsters can have MOVETYPE_STEP and still get velocity if supported by physics.
    // But runStep usually overrides/dampens velocity unless in air.
    // We will assume physics engine handles ground detachment.

    self.groundentity = null;
}

function mutant_hit_left(self: Entity, context: any): void {
    if (!self.enemy) return;
    if (!infront(self, self.enemy)) return;
    const dist = rangeTo(self, self.enemy);
    if (dist > 80) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Damage corrected to 10
    T_Damage(self.enemy as any, self as any, self as any, dir, self.origin, { x: 0, y: 0, z: 0 }, 10, 10, 0, DamageMod.UNKNOWN);
}

function mutant_hit_right(self: Entity, context: any): void {
    if (!self.enemy) return;
    if (!infront(self, self.enemy)) return;
    const dist = rangeTo(self, self.enemy);
    if (dist > 80) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    T_Damage(self.enemy as any, self as any, self as any, dir, self.origin, { x: 0, y: 0, z: 0 }, 10, 10, 0, DamageMod.UNKNOWN);
}


function mutant_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function mutant_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function mutant_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frame definitions (approximated)
const stand_frames: MonsterFrame[] = Array.from({ length: 51 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 50,
  frames: stand_frames,
  endfunc: mutant_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 21 }, () => ({
  ai: monster_ai_walk,
  dist: 6,
}));

walk_move = {
  firstframe: 51,
  lastframe: 71,
  frames: walk_frames,
  endfunc: mutant_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_run,
  dist: 20,
}));

run_move = {
  firstframe: 72,
  lastframe: 77,
  frames: run_frames,
  endfunc: mutant_run,
};

const attack_frames: MonsterFrame[] = Array.from({ length: 12 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 5 ? mutant_hit_left : (i === 10 ? mutant_hit_right : null)
}));

attack_move = {
    firstframe: 78,
    lastframe: 89,
    frames: attack_frames,
    endfunc: mutant_run
};

const jump_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
    ai: monster_ai_move, // Use generic move to allow physics to work without resetting pos
    dist: 0,
    think: i === 2 ? mutant_jump : null
}));

jump_move = {
    firstframe: 90, // Reuse/overlay frames in reality, using placeholder index
    lastframe: 99,
    frames: jump_frames,
    endfunc: mutant_run
};


const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 100,
  lastframe: 105,
  frames: pain_frames,
  endfunc: mutant_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

death_move = {
  firstframe: 106,
  lastframe: 115,
  frames: death_frames,
  endfunc: mutant_dead,
};

export function SP_monster_mutant(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_mutant';
  self.model = 'models/monsters/mutant/tris.md2';
  self.mins = { x: -32, y: -32, z: -24 };
  self.maxs = { x: 32, y: 32, z: 64 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 300;
  self.max_health = 300;
  self.mass = 300;
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

    mutant_die(self);
  };

  self.monsterinfo.stand = mutant_stand;
  self.monsterinfo.walk = mutant_walk;
  self.monsterinfo.run = mutant_run;
  self.monsterinfo.attack = mutant_attack;
  self.monsterinfo.checkattack = mutant_checkattack; // Wire up checkattack

  self.think = monster_think;

  mutant_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMutantSpawns(registry: SpawnRegistry): void {
  registry.register('monster_mutant', SP_monster_mutant);
}
