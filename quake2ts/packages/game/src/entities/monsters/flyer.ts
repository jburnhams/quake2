import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import { M_ShouldReactToPain } from './common.js';
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
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { rangeTo, infront } from '../../ai/perception.js';
import { T_Damage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';

const MONSTER_TICK = 0.1;

// Wrappers
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, MONSTER_TICK, context);
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

function flyer_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function flyer_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function flyer_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function flyer_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function flyer_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Fire blaster
    // Offset for firing position
    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_blaster(self, start, forward, 5, 1000, 0, 0, context, DamageMod.BLASTER);
}

function flyer_slash(self: Entity, context: any): void {
    if (!self.enemy) return;

    const damage = 5 + Math.random() * 5;
    const dist = rangeTo(self, self.enemy);
    if (dist <= 80 && infront(self, self.enemy)) {
        T_Damage(self.enemy as any, self as any, self as any,
             normalizeVec3(subtractVec3(self.enemy.origin, self.origin)),
             self.enemy.origin, ZERO_VEC3, damage, 5, DamageFlags.NO_ARMOR, DamageMod.UNKNOWN, context.timeSeconds);
    }
}

function flyer_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function flyer_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function flyer_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames
// Stand: 0-45
const stand_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 45,
  frames: stand_frames,
  endfunc: flyer_stand,
};

// Walk: 0-45
const walk_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_walk,
  dist: 5,
}));

walk_move = {
  firstframe: 0,
  lastframe: 45,
  frames: walk_frames,
  endfunc: flyer_walk,
};

// Run: 0-45
const run_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 0,
  lastframe: 45,
  frames: run_frames,
  endfunc: flyer_run,
};

// Attack: 46-65
const attack_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 10) ? flyer_fire : (i === 12 ? flyer_slash : null) // Mix attacks for now
}));

attack_move = {
    firstframe: 46,
    lastframe: 65,
    frames: attack_frames,
    endfunc: flyer_run
};

// Pain: 66-71
const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 66,
    lastframe: 71,
    frames: pain_frames,
    endfunc: flyer_run
}

// Death: 84-93
const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 84,
    lastframe: 93,
    frames: death_frames,
    endfunc: flyer_dead
}

export function SP_monster_flyer(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_flyer';
  self.model = 'models/monsters/flyer/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 24 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 50 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 50;
  self.takedamage = true;
  self.flags |= EntityFlags.Fly;
  self.viewheight = 18;

  self.pain = (self, other, kick, damage) => {
    if (!M_ShouldReactToPain(self, context.entities)) {
        return;
    }

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

    flyer_die(self);
  };

  self.monsterinfo.stand = flyer_stand;
  self.monsterinfo.walk = flyer_walk;
  self.monsterinfo.run = flyer_run;
  self.monsterinfo.attack = flyer_attack;

  self.think = monster_think;

  flyer_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerFlyerSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flyer', SP_monster_flyer);
}
