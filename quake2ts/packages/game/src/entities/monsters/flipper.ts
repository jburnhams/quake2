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
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3 } from '@quake2ts/shared';
import { rangeTo, infront } from '../../ai/perception.js';
import { T_Damage } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { DamageMod } from '../../combat/damageMods.js';
import { createRandomGenerator } from '@quake2ts/shared';
import { EntitySystem } from '../system.js';

const random = createRandomGenerator();
const MONSTER_TICK = 0.1;

// Wrappers
function monster_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
  ai_stand(self, MONSTER_TICK);
}

function monster_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function monster_ai_run(self: Entity, dist: number, context: EntitySystem): void {
  ai_run(self, dist, MONSTER_TICK, context);
}

function monster_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: EntitySystem): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;

function flipper_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function flipper_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function flipper_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function flipper_attack(self: Entity): void {
  self.monsterinfo.current_move = attack_move;
}

function flipper_bite(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    const damage = 5 + random.frandom() * 5;
    const dist = rangeTo(self, self.enemy);
    if (dist <= 60 && infront(self, self.enemy)) {
        T_Damage(self.enemy as any, self as any, self as any,
             normalizeVec3(subtractVec3(self.enemy.origin, self.origin)),
             self.enemy.origin, ZERO_VEC3, damage, 0, DamageFlags.NO_ARMOR, DamageMod.UNKNOWN);
    }
}

function flipper_preattack(self: Entity, context: EntitySystem): void {
    // Play sound
}

function flipper_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function flipper_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function flipper_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

// Frames
// Stand: 0-29 (C: FRAME_flphor01 to FRAME_flphor01 looping 29 times? No, just 1 frame looping?)
// C: flipper_frames_stand[] = { { ai_stand } };
// MMOVE_T(flipper_move_stand) = { FRAME_flphor01, FRAME_flphor01, flipper_frames_stand, nullptr };
// So it's 1 frame. My previous implementation had 30. I will follow C.
const stand_frames: MonsterFrame[] = Array.from({ length: 1 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 0,
  frames: stand_frames,
  endfunc: flipper_stand,
};

// Walk: 0-23 (C: flipper_frames_walk[] = 24 frames)
// Uses FRAME_flphor01 to FRAME_flphor24
const walk_frames: MonsterFrame[] = Array.from({ length: 24 }, () => ({
  ai: monster_ai_walk,
  dist: 4,
}));

walk_move = {
  firstframe: 0,
  lastframe: 23,
  frames: walk_frames,
  endfunc: flipper_walk,
};

// Run: 29-52 (C: flipper_frames_run[] = 24 frames)
// C: FRAME_flpver06 to FRAME_flpver29.
// Start run: flipper_frames_start_run[] (5 frames) FRAME_flpver01 to FRAME_flpver06?
// My previous implementation was different.
// Let's use a single run sequence for simplicity or match C.
// C has `flipper_start_run` then `flipper_run_loop`.
// I'll just use a loop.
const run_frames: MonsterFrame[] = Array.from({ length: 24 }, () => ({
  ai: monster_ai_run,
  dist: 24,
}));

run_move = {
  firstframe: 29,
  lastframe: 52,
  frames: run_frames,
  endfunc: flipper_run,
};

// Attack: 53-72 (C: FRAME_flpbit01 to FRAME_flpbit20 - 20 frames)
// Bites at frame 13 and 18 (indices)
const attack_frames: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 10,
    think: (i === 0) ? flipper_preattack : ((i === 13 || i === 18) ? flipper_bite : undefined)
}));

attack_move = {
    firstframe: 53,
    lastframe: 72,
    frames: attack_frames,
    endfunc: flipper_run
};

// Pain 1: 5 frames
// C: FRAME_flppn101 to FRAME_flppn105
const pain1_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));
pain_move = { // Simplified to just one pain for now, or add another
    firstframe: 73,
    lastframe: 77,
    frames: pain1_frames,
    endfunc: flipper_run
};

// Death: 56 frames
// C: FRAME_flpdth01 to FRAME_flpdth56
const death_frames: MonsterFrame[] = Array.from({ length: 56 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 78,
    lastframe: 133,
    frames: death_frames,
    endfunc: flipper_dead
}

export function SP_monster_flipper(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_flipper';
  self.model = 'models/monsters/flipper/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 50;
  self.max_health = 50;
  self.mass = 100;
  self.takedamage = true;
  self.flags |= EntityFlags.Swim;
  self.viewheight = 24;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    // Debounce pain
    if (self.timestamp < (self.pain_finished_time || 0)) return;
    self.pain_finished_time = self.timestamp + 3.0;

    self.monsterinfo.current_move = pain_move;
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -30) { // Gib health -30
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    self.monsterinfo.current_move = death_move;
  };

  self.monsterinfo.stand = flipper_stand;
  self.monsterinfo.walk = flipper_walk;
  self.monsterinfo.run = flipper_run;
  self.monsterinfo.attack = flipper_attack;

  self.think = monster_think;

  flipper_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;

  // swimmonster_start logic:
  // self.flags |= FL_SWIM
  // self.air_finished = level.time + 12
  // self.movetype = MOVETYPE_STEP
}

export function registerFlipperSpawns(registry: SpawnRegistry): void {
  registry.register('monster_flipper', SP_monster_flipper);
}
