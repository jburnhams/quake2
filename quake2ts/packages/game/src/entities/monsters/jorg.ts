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
import { monster_fire_rocket, monster_fire_blaster } from './attack.js';
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

function jorg_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function jorg_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function jorg_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function jorg_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function jorg_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Jorg (Makron Suit) has dual chainguns and BFG
    // Using blaster/rocket as placeholder for now
    monster_fire_blaster(self, start, forward, 20, 1000, 0, 0, context, DamageMod.BLASTER);
}

function jorg_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function jorg_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function jorg_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
  // TODO: Spawn Makron (monster_makron) upon death!
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
  endfunc: jorg_stand,
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
  endfunc: jorg_walk,
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
  endfunc: jorg_run,
};

// Attack
const attack_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 15) ? jorg_fire : null
}));

attack_move = {
    firstframe: 46,
    lastframe: 75,
    frames: attack_frames,
    endfunc: jorg_run
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
    endfunc: jorg_run
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
    endfunc: jorg_dead
}


export function SP_monster_jorg(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_jorg';
  self.model = 'models/monsters/boss3/jorg.md2';
  self.mins = { x: -80, y: -80, z: -24 };
  self.maxs = { x: 80, y: 80, z: 140 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 1000;
  self.takedamage = true;
  self.viewheight = 120;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    // Jorg doesn't gib, he crashes and releases Makron
    // if (self.health < -80) { ... }

    jorg_die(self);
  };

  self.monsterinfo.stand = jorg_stand;
  self.monsterinfo.walk = jorg_walk;
  self.monsterinfo.run = jorg_run;
  self.monsterinfo.attack = jorg_attack;

  self.think = monster_think;

  jorg_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerJorgSpawns(registry: SpawnRegistry): void {
  registry.register('monster_jorg', SP_monster_jorg);
}
