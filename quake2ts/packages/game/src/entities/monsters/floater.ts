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
import { monster_fire_blaster } from './attack.js';
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

function floater_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function floater_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function floater_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function floater_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function floater_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Fire blaster
    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Floater fires slightly stronger blaster? Or same. Using same for now.
    monster_fire_blaster(self, start, forward, 5, 1000, 0, 0, context, DamageMod.BLASTER);
}

function floater_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function floater_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function floater_dead(self: Entity): void {
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
  endfunc: floater_stand,
};

// Walk
const walk_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_walk,
  dist: 5,
}));

walk_move = {
  firstframe: 0,
  lastframe: 45,
  frames: walk_frames,
  endfunc: floater_walk,
};

// Run
const run_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 0,
  lastframe: 45,
  frames: run_frames,
  endfunc: floater_run,
};

// Attack
const attack_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 10) ? floater_fire : null
}));

attack_move = {
    firstframe: 46,
    lastframe: 65,
    frames: attack_frames,
    endfunc: floater_run
};

// Pain
const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 66,
    lastframe: 71,
    frames: pain_frames,
    endfunc: floater_run
}

// Death
const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 84,
    lastframe: 93,
    frames: death_frames,
    endfunc: floater_dead
}


export function SP_monster_floater(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_floater';
  self.model = 'models/monsters/floater/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 24 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 200;
  self.max_health = 200;
  self.mass = 300;
  self.takedamage = true;
  self.flags |= EntityFlags.Fly;
  self.viewheight = 18;

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

    floater_die(self);
  };

  self.monsterinfo.stand = floater_stand;
  self.monsterinfo.walk = floater_walk;
  self.monsterinfo.run = floater_run;
  self.monsterinfo.attack = floater_attack;

  self.think = monster_think;

  floater_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerFloaterSpawns(registry: SpawnRegistry): void {
  registry.register('monster_floater', SP_monster_floater);
}
