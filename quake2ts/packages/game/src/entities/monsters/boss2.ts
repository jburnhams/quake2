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

function boss2_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function boss2_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function boss2_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function boss2_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function boss2_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Boss2 (Hornet) fires rockets and blasters
    // Simple alternation for now
    if (context.rng.random() > 0.5) {
        monster_fire_rocket(self, start, forward, 50, 700, 0, context);
    } else {
        monster_fire_blaster(self, start, forward, 10, 1000, 0, 0, context, DamageMod.BLASTER);
    }
}

function boss2_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function boss2_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function boss2_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
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
  endfunc: boss2_stand,
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
  endfunc: boss2_walk,
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
  endfunc: boss2_run,
};

// Attack
const attack_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 15) ? boss2_fire : null
}));

attack_move = {
    firstframe: 46,
    lastframe: 75,
    frames: attack_frames,
    endfunc: boss2_run
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
    endfunc: boss2_run
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
    endfunc: boss2_dead
}


export function SP_monster_boss2(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_boss2';
  self.model = 'models/monsters/boss2/tris.md2';
  self.mins = { x: -64, y: -64, z: -16 };
  self.maxs = { x: 64, y: 64, z: 80 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 1000;
  self.takedamage = true;
  self.flags |= EntityFlags.Fly;
  self.viewheight = 64;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -80) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    boss2_die(self);
  };

  self.monsterinfo.stand = boss2_stand;
  self.monsterinfo.walk = boss2_walk;
  self.monsterinfo.run = boss2_run;
  self.monsterinfo.attack = boss2_attack;

  self.think = monster_think;

  boss2_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerBoss2Spawns(registry: SpawnRegistry): void {
  registry.register('monster_boss2', SP_monster_boss2);
}
