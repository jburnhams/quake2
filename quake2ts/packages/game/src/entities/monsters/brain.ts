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
import { Vec3, normalizeVec3, subtractVec3, addVec3, scaleVec3, ZERO_VEC3, angleVectors, vectorToAngles, ServerCommand, TempEntity } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { monster_fire_dabeam, monster_fire_hit } from './attack.js';
import { MulticastType } from '../../imports.js';
import { range, Range } from '../../ai/targeting.js';
import { RANGE_NEAR } from '../../ai/constants.js';

const MONSTER_TICK = 0.1;
const MELEE_DISTANCE = 80;

// Helper to access deterministic RNG or Math.random
const random = Math.random;

// Wrappers for AI functions
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
let idle_move: MonsterMove;
let walk1_move: MonsterMove;
let run_move: MonsterMove;
let attack1_move: MonsterMove;
let attack2_move: MonsterMove;
let attack3_move: MonsterMove;
let attack4_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let duck_move: MonsterMove;

function brain_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function brain_idle(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'brain/brnlens1.wav', 1, 0, 0); // ATTN_IDLE = 0 ? usually 2 or 3
  self.monsterinfo.current_move = idle_move;
}

function brain_walk(self: Entity): void {
  self.monsterinfo.current_move = walk1_move;
}

function brain_run(self: Entity): void {
  self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN
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
  } else {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 3.0;
  }
}

function brain_swing_left(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'brain/melee2.wav', 1, 1, 0);
}

function brain_hit_left(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: self.mins.x, z: 8 };
  if (monster_fire_hit(self, aim, 15 + Math.floor(random() * 5), 40, context)) {
    context.engine.sound?.(self, 0, 'brain/melee3.wav', 1, 1, 0);
  } else {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 3.0;
  }
}

function brain_chest_open(self: Entity, context: any): void {
  self.count = 0;
  self.monsterinfo.power_armor_type = 0; // NONE
  context.engine.sound?.(self, 0, 'brain/brnatck1.wav', 1, 1, 0);
}

function brain_tentacle_attack(self: Entity, context: any): void {
  const aim = { x: MELEE_DISTANCE, y: 0, z: 8 };
  if (monster_fire_hit(self, aim, 10 + Math.floor(random() * 5), -600, context)) {
    self.count = 1;
  } else {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 3.0;
  }
  context.engine.sound?.(self, 0, 'brain/brnatck3.wav', 1, 1, 0);
}

function brain_chest_closed(self: Entity): void {
  self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN
  if (self.count) {
    self.count = 0;
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

// Tongue attack
function brain_tounge_attack(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  // Logic from m_brain.cpp
  const f = angleVectors(self.angles).forward;
  const start = { ...self.origin };
  start.z += 24; // offset

  const end = { ...self.enemy.origin };

  // Trace
  const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, 0x1 | 0x2 | 0x40000000 | 0x20000000);
  if (tr.ent !== self.enemy) return;

  context.engine.sound?.(self, 0, 'brain/brnatck3.wav', 1, 1, 0);

  context.multicast(self.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.PARASITE_ATTACK, self, start, end);

  const dir = subtractVec3(start, end);
  T_Damage(self.enemy as unknown as Damageable, self as unknown as Damageable, self as unknown as Damageable, dir, self.enemy.origin, ZERO_VEC3, 5, 0, 0, DamageMod.BRAINTENTACLE, context.timeSeconds);

  // Pull enemy
  self.origin = { ...self.origin, z: self.origin.z + 1 }; // hack to trigger physics?
  const forward = angleVectors(self.angles).forward;
  self.enemy.velocity = scaleVec3(forward, -1200);
}

// Laser Attack
const brain_reye: Vec3[] = [
    { x: 0.746700, y: 0.238370, z: 34.167690 },
    { x: -1.076390, y: 0.238370, z: 33.386372 },
    { x: -1.335500, y: 5.334300, z: 32.177170 },
    { x: -0.175360, y: 8.846370, z: 30.635479 },
    { x: -2.757590, y: 7.804610, z: 30.150860 },
    { x: -5.575090, y: 5.152840, z: 30.056160 },
    { x: -7.017550, y: 3.262470, z: 30.552521 },
    { x: -7.915740, y: 0.638800, z: 33.176189 },
    { x: -3.915390, y: 8.285730, z: 33.976349 },
    { x: -0.913540, y: 10.933030, z: 34.141811 },
    { x: -0.369900, y: 8.923900, z: 34.189079 }
];

const brain_leye: Vec3[] = [
    { x: -3.364710, y: 0.327750, z: 33.938381 },
    { x: -5.140450, y: 0.493480, z: 32.659851 },
    { x: -5.341980, y: 5.646980, z: 31.277901 },
    { x: -4.134480, y: 9.277440, z: 29.925621 },
    { x: -6.598340, y: 6.815090, z: 29.322620 },
    { x: -8.610840, y: 2.529650, z: 29.251591 },
    { x: -9.231360, y: 0.093280, z: 29.747959 },
    { x: -11.004110, y: 1.936930, z: 32.395260 },
    { x: -7.878310, y: 7.648190, z: 33.148151 },
    { x: -4.947370, y: 11.430050, z: 33.313610 },
    { x: -4.332820, y: 9.444570, z: 33.526340 }
];

function brain_right_eye_laser_update(beam: Entity, context: EntitySystem): void {
    const self = beam.owner;
    if (!self || !self.inUse || !self.enemy) return;

    const { forward, right, up } = angleVectors(self.angles);

    // Frame offset
    let frameIdx = self.frame - 0; // FRAME_walk101 is 0
    if (frameIdx < 0 || frameIdx >= brain_reye.length) frameIdx = 0;

    const offset = brain_reye[frameIdx];

    let start = addVec3(self.origin, scaleVec3(right, offset.x));
    start = addVec3(start, scaleVec3(forward, offset.y));
    start = addVec3(start, scaleVec3(up, offset.z));

    // Target prediction logic omitted for brevity, just aim at enemy
    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    beam.origin = start;
    beam.movedir = dir;
    context.linkentity(beam);
}

function brain_left_eye_laser_update(beam: Entity, context: EntitySystem): void {
    const self = beam.owner;
    if (!self || !self.inUse || !self.enemy) return;

    const { forward, right, up } = angleVectors(self.angles);

    // Frame offset
    let frameIdx = self.frame - 0; // FRAME_walk101 is 0
    if (frameIdx < 0 || frameIdx >= brain_leye.length) frameIdx = 0;

    const offset = brain_leye[frameIdx];

    let start = addVec3(self.origin, scaleVec3(right, offset.x));
    start = addVec3(start, scaleVec3(forward, offset.y));
    start = addVec3(start, scaleVec3(up, offset.z));

    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    beam.origin = start;
    beam.movedir = dir;
    context.linkentity(beam);
}

function brain_laserbeam(self: Entity, context: EntitySystem): void {
    monster_fire_dabeam(self, 1, false, brain_right_eye_laser_update, context);
    monster_fire_dabeam(self, 1, true, brain_left_eye_laser_update, context);
}

function brain_laserbeam_reattack(self: Entity): void {
    if (random() < 0.5) {
       // if visible and alive, restart attack4 sequence (set frame to walk101 which is start of attack4)
       if (self.enemy && self.enemy.health > 0) {
           self.frame = 0; // FRAME_walk101
       }
    }
}


function brain_attack(self: Entity, context: EntitySystem): void {
    const r = range(self, self.enemy!);
    if (r <= RANGE_NEAR) {
        if (random() < 0.5) {
            self.monsterinfo.current_move = attack3_move;
        } else {
             // Check spawnflag for no lasers?
             self.monsterinfo.current_move = attack4_move;
        }
    } else {
        self.monsterinfo.current_move = attack4_move;
    }
}


function brain_sight(self: Entity, other: Entity): void {
  // context.entities.sound?.(self, 2, 'brain/brnsght1.wav', 1, 1, 0); // Need context access or pass it
}

// Duck/Dodge
function brain_duck_down(self: Entity): boolean {
  if (self.monsterinfo.aiflags & 16) return true; // AI_DUCKED
  self.monsterinfo.aiflags |= 16;
  // self.maxs.z -= 32;
  // gi.linkentity(self);
  return true;
}

function brain_duck_hold(self: Entity): void {
}

function brain_duck_up(self: Entity): void {
  self.monsterinfo.aiflags &= ~16;
  // self.maxs.z += 32;
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

// ATTACK3 (Tongue)
const attack3_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 5 },
    { ai: monster_ai_charge, dist: -4 },
    { ai: monster_ai_charge, dist: -4 },
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 0, think: brain_chest_open },
    { ai: monster_ai_charge, dist: 0, think: brain_tounge_attack },
    { ai: monster_ai_charge, dist: 13 },
    { ai: monster_ai_charge, dist: 0, think: brain_tentacle_attack },
    { ai: monster_ai_charge, dist: 2 },
    { ai: monster_ai_charge, dist: 0, think: brain_tounge_attack },
    { ai: monster_ai_charge, dist: -9, think: brain_chest_closed },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 3 },
    { ai: monster_ai_charge, dist: 2 },
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: -6 },
];
attack3_move = { firstframe: 71, lastframe: 87, frames: attack3_frames, endfunc: brain_run };

// ATTACK4 (Lasers)
const attack4_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 9, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 2, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 3, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 3, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 1, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 0, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 0, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 10, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: -4, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: -1, think: brain_laserbeam },
    { ai: monster_ai_charge, dist: 2, think: brain_laserbeam_reattack },
];
attack4_move = { firstframe: 0, lastframe: 10, frames: attack4_frames, endfunc: brain_run };


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
  self.monsterinfo.power_armor_type = 0; // NONE

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
  self.health = 300 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 400;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => brain_pain(ent, other, kick, dmg, context.entities);
  self.die = (ent, infl, att, dmg, pt) => brain_die(ent, infl, att, dmg, pt, context.entities);

  self.monsterinfo.stand = brain_stand;
  self.monsterinfo.walk = brain_walk;
  self.monsterinfo.run = brain_run;
  self.monsterinfo.dodge = brain_dodge;
  self.monsterinfo.duck = brain_duck_down; // Approximate interface
  self.monsterinfo.unduck = brain_duck_up;
  self.monsterinfo.attack = brain_attack;
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
  self.monsterinfo.idle = (s) => brain_idle(s, context.entities);

  self.monsterinfo.power_armor_type = 1; // POWER_ARMOR_SCREEN
  self.monsterinfo.power_armor_power = 100;

  self.think = monster_think;

  brain_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerBrainSpawns(registry: SpawnRegistry): void {
  registry.register('monster_brain', SP_monster_brain);
}
