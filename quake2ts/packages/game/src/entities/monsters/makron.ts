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
  EntityFlags,
  PainCallback
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { monster_fire_blaster, monster_fire_railgun, monster_fire_bfg } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3, angleVectors, scaleVec3, addVec3, ZERO_VEC3, lengthVec3, vectorToAngles } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { visible, rangeTo } from '../../ai/perception.js';

const MONSTER_TICK = 0.1;

// Offsets
const MAKRON_BFG_OFFSET: Vec3 = { x: 30, y: 28, z: 24 };
const MAKRON_BLASTER_OFFSET_1: Vec3 = { x: 26, y: 16, z: 24 }; // And others, calculated dynamically in C
const MAKRON_RAILGUN_OFFSET: Vec3 = { x: 26, y: -14, z: 24 };

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
let attack_bfg_move: MonsterMove;
let attack_hyperblaster_move: MonsterMove;
let attack_railgun_move: MonsterMove;
let pain4_move: MonsterMove;
let pain5_move: MonsterMove;
let pain6_move: MonsterMove;
let death_move: MonsterMove;
let sight_move: MonsterMove;

function makron_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function makron_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function makron_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function makron_attack(self: Entity): void {
    if (!self.enemy) return;

    // Attack 3: BFG
    // Attack 4: Hyperblaster
    // Attack 5: Railgun

    const r = Math.random();

    if (r <= 0.3) {
        self.monsterinfo.current_move = attack_bfg_move;
    } else if (r <= 0.6) {
        self.monsterinfo.current_move = attack_hyperblaster_move;
    } else {
        self.monsterinfo.current_move = attack_railgun_move;
    }
}

function getProjectedOffset(self: Entity, offset: Vec3): Vec3 {
    const { forward, right, up } = angleVectors(self.angles);
    const start = { ...self.origin };

    const x = scaleVec3(forward, offset.x);
    const y = scaleVec3(right, offset.y);
    const z = scaleVec3(up, offset.z);

    return addVec3(addVec3(addVec3(start, x), y), z);
}

function makron_fire_bfg(self: Entity, context: any): void {
    if (!self.enemy) return;

    context.engine.sound?.(self, 0, 'makron/bfg_fire.wav', 1, 1, 0);

    const start = getProjectedOffset(self, MAKRON_BFG_OFFSET);
    const target = { ...self.enemy.origin };
    target.z += (self.enemy.viewheight || 0);
    const dir = normalizeVec3(subtractVec3(target, start));

    monster_fire_bfg(self, start, dir, 50, 300, 100, 300, 0, context);
}

function makron_fire_railgun(self: Entity, context: any): void {
    if (!self.pos1) return; // Need saved aim pos

    context.engine.sound?.(self, 0, 'makron/rail_fire.wav', 1, 1, 0);

    const start = getProjectedOffset(self, MAKRON_RAILGUN_OFFSET);
    const dir = normalizeVec3(subtractVec3(self.pos1, start));

    monster_fire_railgun(self, start, dir, 50, 100, 0, context);
}

function makron_save_loc(self: Entity): void {
    if (!self.enemy) return;
    // Save target position for railgun aim
    self.pos1 = { ...self.enemy.origin };
    // Fix: Assign z properly to pos1
    self.pos1 = { ...self.pos1, z: self.pos1.z + (self.enemy.viewheight || 0) };
}

function makron_fire_hyperblaster(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'makron/blaster.wav', 1, 1, 0);

    const start = getProjectedOffset(self, MAKRON_BLASTER_OFFSET_1);

    const relFrame = (self.monsterinfo.nextframe || 0) - attack_hyperblaster_move.firstframe;

    // C Logic Mapping for sweep:
    // 4 to 12: sweep left
    // 13 to 20: sweep right

    let yawDelta = 0;
    // if (relFrame <= 13) { // Not used for now, just commented logic
    //     yawDelta = -10 * (relFrame - 4);
    // } else {
    //     yawDelta = -90 + 10 * (relFrame - 13);
    // }

    let dir: Vec3;
    if (self.enemy) {
        const target = { ...self.enemy.origin };
        target.z += (self.enemy.viewheight || 0);
        const vec = subtractVec3(target, start);
        const baseAngles = vectorToAngles(vec);

        // Create a mutable copy
        const enemyAngles = { ...baseAngles };

        // Apply sweep to yaw
        if (relFrame <= 12) {
             enemyAngles.y -= 5 * (relFrame - 4);
        } else {
             enemyAngles.y -= 40 - 5 * (relFrame - 12);
        }

        const forward = angleVectors(enemyAngles).forward;
        dir = forward;
    } else {
        const { forward } = angleVectors(self.angles);
        dir = forward;
    }

    monster_fire_blaster(self, start, dir, 15, 1000, 0, 0, context, DamageMod.BLASTER);
}


function makron_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: any): void {
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;

    if (damage <= 25 && Math.random() < 0.2) return;

    self.pain_finished_time = self.timestamp + 3.0;

    if (damage <= 40) {
        context.engine.sound?.(self, 0, 'makron/pain1.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain4_move;
    } else if (damage <= 110) {
        context.engine.sound?.(self, 0, 'makron/pain2.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain5_move;
    } else {
        if (Math.random() <= 0.45) {
             context.engine.sound?.(self, 0, 'makron/pain3.wav', 1, 1, 0);
             self.monsterinfo.current_move = pain6_move;
        }
    }
}

function makron_die(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'makron/death.wav', 1, 1, 0);
    // Spawn torso gib?
    self.monsterinfo.current_move = death_move;
}

function makron_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
}

// Frames
// Stand: 60 frames
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({ ai: monster_ai_stand, dist: 0 }));
stand_move = { firstframe: 0, lastframe: 59, frames: stand_frames, endfunc: makron_stand };

// Walk: 10 frames
const walk_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({ ai: monster_ai_walk, dist: 8 }));
walk_move = { firstframe: 60, lastframe: 69, frames: walk_frames, endfunc: makron_walk };

// Run: 10 frames
const run_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({ ai: monster_ai_run, dist: 8 }));
run_move = { firstframe: 60, lastframe: 69, frames: run_frames, endfunc: makron_run };

// Attack BFG: 8 frames
const attack_bfg_frames: MonsterFrame[] = Array.from({ length: 8 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 3) ? makron_fire_bfg : null
}));
attack_bfg_move = { firstframe: 70, lastframe: 77, frames: attack_bfg_frames, endfunc: makron_run };

// Attack Hyperblaster: 26 frames
const attack_hyperblaster_frames: MonsterFrame[] = Array.from({ length: 26 }, (_, i) => ({
    ai: monster_ai_move,
    dist: 0,
    think: (i >= 4 && i <= 20) ? makron_fire_hyperblaster : null
}));
attack_hyperblaster_move = { firstframe: 78, lastframe: 103, frames: attack_hyperblaster_frames, endfunc: makron_run };

// Attack Railgun: 16 frames
const attack_railgun_frames: MonsterFrame[] = Array.from({ length: 16 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 7) ? makron_save_loc : ((i === 8) ? makron_fire_railgun : null)
}));
attack_railgun_move = { firstframe: 104, lastframe: 119, frames: attack_railgun_frames, endfunc: makron_run };

// Pain 4: 4 frames
const pain4_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain4_move = { firstframe: 120, lastframe: 123, frames: pain4_frames, endfunc: makron_run };

// Pain 5: 4 frames
const pain5_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain5_move = { firstframe: 124, lastframe: 127, frames: pain5_frames, endfunc: makron_run };

// Pain 6: 27 frames
const pain6_frames: MonsterFrame[] = Array.from({ length: 27 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain6_move = { firstframe: 128, lastframe: 154, frames: pain6_frames, endfunc: makron_run };

// Death: 95 frames
const death_frames: MonsterFrame[] = Array.from({ length: 95 }, () => ({ ai: monster_ai_move, dist: 0 }));
death_move = { firstframe: 155, lastframe: 249, frames: death_frames, endfunc: makron_dead };

// Sight: 13 frames
const sight_frames: MonsterFrame[] = Array.from({ length: 13 }, () => ({ ai: monster_ai_move, dist: 0 }));
sight_move = { firstframe: 250, lastframe: 262, frames: sight_frames, endfunc: makron_run };


export function SP_monster_makron(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_makron';
  self.model = 'models/monsters/boss3/rider/tris.md2';

  // Gibs
  // context.precacheModel('models/objects/gibs/sm_meat/tris.md2');
  // ... remove precacheModel ...

  self.mins = { x: -30, y: -30, z: 0 };
  self.maxs = { x: 30, y: 30, z: 90 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 500;
  self.takedamage = true;
  self.viewheight = 90; // Guess? C code uses viewheight for aiming

  self.pain = (ent, other, kick, dmg) => makron_pain(ent, other, kick, dmg, context.entities);
  self.die = (self, inflictor, attacker, damage, point) => {
    // Check for gib
    if (self.health <= -2000) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;
    makron_die(self, context.entities);
  };

  self.monsterinfo.stand = makron_stand;
  self.monsterinfo.walk = makron_walk;
  self.monsterinfo.run = makron_run;
  self.monsterinfo.attack = makron_attack;
  self.monsterinfo.sight = (self, other) => {
      context.entities.sound?.(self, 0, 'makron/sight.wav', 1, 1, 0);
      self.monsterinfo.current_move = sight_move;
  };

  self.think = monster_think;

  // Initial state logic
  // C code uses sight frame first?
  self.monsterinfo.current_move = sight_move;

  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMakronSpawns(registry: SpawnRegistry): void {
  registry.register('monster_makron', SP_monster_makron);
}
