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
import { monster_fire_rocket } from './attack.js';
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
let attack_rocket_move: MonsterMove;
let attack_chain_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function supertank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function supertank_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function supertank_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function supertank_attack(self: Entity): void {
  // Randomly choose between rocket and chaingun
  // Since we don't have random yet fully integrated in entity logic sometimes, we can check dist or just random.
  // But context.random might be needed.
  // Using Math.random() for now as simple fallback, but ideally should be deterministic.
  // However, `Entity` doesn't hold RNG state.
  // For now, let's just pick rocket attack.
  // TODO: Add proper attack selection logic based on range/random
  self.monsterinfo.current_move = attack_rocket_move;
}

function supertank_fire_rocket(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_rocket(self, start, forward, 50, 650, 0, context);
}

function supertank_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function supertank_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function supertank_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames (Placeholders based on Icarus structure)
// Stand
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 59,
  frames: stand_frames,
  endfunc: supertank_stand,
};

// Walk
const walk_frames: MonsterFrame[] = Array.from({ length: 50 }, () => ({
  ai: monster_ai_walk,
  dist: 10,
}));

walk_move = {
  firstframe: 60,
  lastframe: 109,
  frames: walk_frames,
  endfunc: supertank_walk,
};

// Run
const run_frames: MonsterFrame[] = Array.from({ length: 50 }, () => ({
  ai: monster_ai_run,
  dist: 20,
}));

run_move = {
  firstframe: 60,
  lastframe: 109,
  frames: run_frames,
  endfunc: supertank_run,
};

// Attack Rocket
const attack_rocket_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 10) ? supertank_fire_rocket : null
}));

attack_rocket_move = {
    firstframe: 110,
    lastframe: 129,
    frames: attack_rocket_frames,
    endfunc: supertank_run
};

// Attack Chaingun (Stub for now, uses same frames)
attack_chain_move = attack_rocket_move;

// Pain
const pain_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 130,
    lastframe: 139,
    frames: pain_frames,
    endfunc: supertank_run
}

// Death
const death_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 140,
    lastframe: 159,
    frames: death_frames,
    endfunc: supertank_dead
}


export function SP_monster_supertank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_supertank';
  self.model = 'models/monsters/boss1/tris.md2';
  self.mins = { x: -64, y: -64, z: -16 };
  self.maxs = { x: 64, y: 64, z: 72 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 1500;
  self.max_health = 1500;
  self.mass = 800;
  self.takedamage = true;
  self.viewheight = 64; // Guess

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -80) { // Big boss needs big damage to gib
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    supertank_die(self);
  };

  self.monsterinfo.stand = supertank_stand;
  self.monsterinfo.walk = supertank_walk;
  self.monsterinfo.run = supertank_run;
  self.monsterinfo.attack = supertank_attack;

  self.think = monster_think;

  supertank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', SP_monster_supertank);
}
