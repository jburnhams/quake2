import {
  angleVectors,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  lengthVec3,
  addVec3,
  scaleVec3,
  MASK_SHOT,
  vectorToAngles,
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  ai_turn,
  ai_face
} from '../../ai/index.js';
import { M_ShouldReactToPain, monster_done_dodge } from './common.js';
import { DamageMod } from '../../combat/damageMods.js';
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
import { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { monster_fire_rocket, monster_fire_hit, monster_fire_heat } from './attack.js';

const MONSTER_TICK = 0.1;
const MELEE_DISTANCE = 80;

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
let walk_move: MonsterMove;
let run_move: MonsterMove;
let start_attack1_move: MonsterMove;
let attack1_move: MonsterMove;
let end_attack1_move: MonsterMove;
let start_slash_move: MonsterMove;
let slash_move: MonsterMove;
let end_slash_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death1_move: MonsterMove;
let death2_move: MonsterMove;
let duck_move: MonsterMove;
let fidget_move: MonsterMove;

function chick_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function chick_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function chick_run(self: Entity): void {
  // Clear blindfire flag
  monster_done_dodge(self);

  if (self.monsterinfo.aiflags & 4) { // AI_STAND_GROUND
    self.monsterinfo.current_move = stand_move;
    return;
  }

  self.monsterinfo.current_move = run_move;
}

function chick_sight(self: Entity, other: Entity): void {
   // Sound logic needs context, skipped or handled externally
}

// Fidget
function chick_fidget(self: Entity, context: EntitySystem): void {
  if (self.monsterinfo.aiflags & 4) return; // AI_STAND_GROUND
  if (self.enemy) return;

  if (context.rng.frandom() <= 0.3) {
    self.monsterinfo.current_move = fidget_move;
  }
}

function ChickMoan(self: Entity, context: EntitySystem): void {
  if (context.rng.frandom() < 0.5) {
     context.engine.sound?.(self, 2, 'chick/chkidle1.wav', 1, 0, 0);
  } else {
     context.engine.sound?.(self, 2, 'chick/chkidle2.wav', 1, 0, 0);
  }
}

// Attacks

function chick_slash(self: Entity, context: EntitySystem): void {
  const aim = { x: MELEE_DISTANCE, y: self.mins.x, z: 10 };
  context.engine.sound?.(self, 0, 'chick/chkatck3.wav', 1, 1, 0);
  monster_fire_hit(self, aim, 10 + context.rng.irandom(6), 100, context);
}

function chick_rocket(self: Entity, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);

  // Approximate offset for rocket launcher on shoulder
  // monster_flash_offset[MZ2_CHICK_ROCKET_1] = { 0, 20, 40 } roughly?
  const offset = { x: 0, y: 20, z: 40 };

  const start = addVec3(self.origin, scaleVec3(forward, offset.x));
  const scaledRight = scaleVec3(right, offset.y);
  const start2 = addVec3(start, scaledRight);
  const finalStart = { ...start2, z: start2.z + offset.z };

  const rocketSpeed = (self.skin > 1) ? 500 : 650;

  const blindfire = !!self.monsterinfo.blindfire;
  let target = ZERO_VEC3;

  if (blindfire && self.monsterinfo.blind_fire_target) {
    target = self.monsterinfo.blind_fire_target;
  } else if (self.enemy) {
    target = self.enemy.origin;
  } else {
    return;
  }

  let dir = subtractVec3(target, finalStart);

  if (!blindfire && self.enemy) {
     if (context.rng.frandom() < 0.33 || finalStart.z < self.enemy.absmin.z) {
         const tempDir = { ...dir, z: dir.z + self.enemy.viewheight };
         dir = tempDir;
     } else {
         const tempDir = { ...dir, z: self.enemy.absmin.z + 1 - finalStart.z };
         dir = tempDir;
     }
  }

  const finalDir = normalizeVec3(dir);

  // Predict aim omitted for brevity

  if (self.skin > 1) {
    monster_fire_heat(self, finalStart, finalDir, 50, rocketSpeed, 0, 0.075, context);
  } else {
    monster_fire_rocket(self, finalStart, finalDir, 50, rocketSpeed, 0, context);
  }
}

function chick_preattack1(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'chick/chkatck1.wav', 1, 1, 0);
  if (self.monsterinfo.blindfire && self.monsterinfo.blind_fire_target) {
     const aim = subtractVec3(self.monsterinfo.blind_fire_target, self.origin);
     self.ideal_yaw = vectorToAngles(aim).y;
  }
}

function chick_reload(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'chick/chkatck5.wav', 1, 1, 0);
}

function chick_attack1(self: Entity): void {
  self.monsterinfo.current_move = attack1_move;
}

function chick_rerocket(self: Entity, context: EntitySystem): void {
  if (self.monsterinfo.blindfire) {
    self.monsterinfo.blindfire = false;
    self.monsterinfo.current_move = end_attack1_move;
    return;
  }

  if (self.enemy && self.enemy.health > 0) {
      if (context.rng.frandom() <= 0.6) { // Simplified range check
          self.monsterinfo.current_move = attack1_move;
          return;
      }
  }
  self.monsterinfo.current_move = end_attack1_move;
}

function chick_reslash(self: Entity, context: EntitySystem): void {
  if (self.enemy && self.enemy.health > 0) {
      // melee range check omitted
      if (context.rng.frandom() <= 0.9) {
          self.monsterinfo.current_move = slash_move;
          return;
      }
  }
  self.monsterinfo.current_move = end_slash_move;
}

function chick_slash_start(self: Entity): void {
    self.monsterinfo.current_move = slash_move;
}

function chick_attack(self: Entity): void {
  // Blindfire logic
  if (self.monsterinfo.attack_state === 4) { // AS_BLIND
     // Logic simplified
     self.monsterinfo.blindfire = true;
     self.monsterinfo.current_move = start_attack1_move;
     return;
  }

  self.monsterinfo.current_move = start_attack1_move;
}

function chick_melee(self: Entity): void {
  self.monsterinfo.current_move = start_slash_move;
}

// Frames

// FIDGET
const fidget_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
  ai: monster_ai_stand,
  dist: 0,
  think: (i === 8) ? (s: Entity, c: EntitySystem) => ChickMoan(s, c) : null
}));
fidget_move = {
  firstframe: 201,
  lastframe: 230,
  frames: fidget_frames,
  endfunc: chick_stand
};


// STAND
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
  ai: monster_ai_stand,
  dist: 0,
  think: (i === 29) ? chick_fidget : null
}));
stand_move = {
  firstframe: 101, // FRAME_stand101
  lastframe: 130,
  frames: stand_frames,
  endfunc: chick_stand
};

// WALK
const walk_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_walk,
  dist: 6
}));
walk_move = {
  firstframe: 171, // FRAME_walk11 (171)
  lastframe: 180, // FRAME_walk20 (180)
  frames: walk_frames,
  endfunc: chick_walk
};

// RUN
const run_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_run,
  dist: 12
}));
run_move = {
  firstframe: 171,
  lastframe: 180,
  frames: run_frames,
  endfunc: chick_run
};

// PAIN
const pain1_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain1_move = { firstframe: 90, lastframe: 94, frames: pain1_frames, endfunc: chick_run }; // FRAME_pain101 = 90 ?

const pain2_frames: MonsterFrame[] = Array.from({ length: 5 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain2_move = { firstframe: 95, lastframe: 99, frames: pain2_frames, endfunc: chick_run };

const pain3_frames: MonsterFrame[] = Array.from({ length: 21 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain3_move = { firstframe: 100, lastframe: 120, frames: pain3_frames, endfunc: chick_run };

function chick_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
  if (self.health < (self.max_health / 2)) {
    self.skin |= 1;
  }

  if (self.timestamp < (self.pain_debounce_time || 0)) return;

  self.pain_debounce_time = self.timestamp + 3;

  const r = context.rng.frandom();
  if (r < 0.33) context.engine.sound?.(self, 0, 'chick/chkpain1.wav', 1, 1, 0);
  else if (r < 0.66) context.engine.sound?.(self, 0, 'chick/chkpain2.wav', 1, 1, 0);
  else context.engine.sound?.(self, 0, 'chick/chkpain3.wav', 1, 1, 0);

  if (!M_ShouldReactToPain(self, context)) {
    return;
  }

  // Clear blindfire
  self.monsterinfo.blindfire = false;

  if (damage <= 10) self.monsterinfo.current_move = pain1_move;
  else if (damage <= 25) self.monsterinfo.current_move = pain2_move;
  else self.monsterinfo.current_move = pain3_move;
}

// DEATH
const death1_frames: MonsterFrame[] = Array.from({ length: 12 }, () => ({ ai: monster_ai_move, dist: 0 }));
death1_move = { firstframe: 48, lastframe: 59, frames: death1_frames, endfunc: chick_dead };

const death2_frames: MonsterFrame[] = Array.from({ length: 23 }, () => ({ ai: monster_ai_move, dist: 0 }));
death2_move = { firstframe: 60, lastframe: 82, frames: death2_frames, endfunc: chick_dead };

function chick_dead(self: Entity): void {
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 16 };
  self.movetype = MoveType.Toss;
  self.nextthink = -1;
  // linkentity
}

function chick_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: EntitySystem): void {
  if (self.health <= -70) { // gib_health
    context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
    throwGibs(context, self.origin, damage);
    context.free(self);
    return;
  }

  if (self.deadflag === DeadFlag.Dead) return;

  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;

  if (context.rng.frandom() <= 0.5) {
    self.monsterinfo.current_move = death1_move;
    context.engine.sound?.(self, 0, 'chick/chkdeth1.wav', 1, 1, 0);
  } else {
    self.monsterinfo.current_move = death2_move;
    context.engine.sound?.(self, 0, 'chick/chkdeth2.wav', 1, 1, 0);
  }
}

// ATTACK 1 (Rocket)
const start_attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0, think: chick_preattack1 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 3 },
    { ai: monster_ai_charge, dist: 5 },
    { ai: monster_ai_charge, dist: 7 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: chick_attack1 },
];
start_attack1_move = { firstframe: 0, lastframe: 12, frames: start_attack1_frames, endfunc: null };

const attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 19, think: chick_rocket },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -5 },
    { ai: monster_ai_charge, dist: -2 },
    { ai: monster_ai_charge, dist: -7 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 10, think: chick_reload },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 5 },
    { ai: monster_ai_charge, dist: 6 },
    { ai: monster_ai_charge, dist: 6 },
    { ai: monster_ai_charge, dist: 4 },
    { ai: monster_ai_charge, dist: 3, think: chick_rerocket },
];
attack1_move = { firstframe: 13, lastframe: 26, frames: attack1_frames, endfunc: null };

const end_attack1_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -4 },
    { ai: monster_ai_charge, dist: -2 },
];
end_attack1_move = { firstframe: 27, lastframe: 31, frames: end_attack1_frames, endfunc: chick_run };

// SLASH
const start_slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 8 },
    { ai: monster_ai_charge, dist: 3 },
];
start_slash_move = { firstframe: 32, lastframe: 34, frames: start_slash_frames, endfunc: chick_slash_start };

const slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 7, think: chick_slash },
    { ai: monster_ai_charge, dist: -7 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 1 },
    { ai: monster_ai_charge, dist: -2, think: chick_reslash },
];
slash_move = { firstframe: 35, lastframe: 43, frames: slash_frames, endfunc: null };

const end_slash_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: -1 },
    { ai: monster_ai_charge, dist: -6 },
    { ai: monster_ai_charge, dist: 0 },
];
end_slash_move = { firstframe: 44, lastframe: 47, frames: end_slash_frames, endfunc: chick_run };

// DUCK
const duck_frames: MonsterFrame[] = Array.from({ length: 7 }, () => ({ ai: monster_ai_move, dist: 0 }));
duck_move = { firstframe: 83, lastframe: 89, frames: duck_frames, endfunc: chick_run };

function chick_dodge(self: Entity, attacker: Entity, eta: number): void {
    if (self.monsterinfo.current_move === start_attack1_move || self.monsterinfo.current_move === attack1_move) {
        return;
    }
    self.monsterinfo.current_move = duck_move;
}

function chick_blocked(self: Entity, dist: number, context: EntitySystem): void {
   // blocked checkplat logic omitted
}

export function SP_monster_chick(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_chick';
  self.model = 'models/monsters/bitch/tris.md2';
  self.mins = { x: -16, y: -16, z: 0 };
  self.maxs = { x: 16, y: 16, z: 56 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 175 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 200;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => chick_pain(ent, other, kick, dmg, context.entities);
  self.die = (ent, infl, att, dmg, pt) => chick_die(ent, infl, att, dmg, pt, context.entities);

  self.monsterinfo.stand = chick_stand;
  self.monsterinfo.walk = chick_walk;
  self.monsterinfo.run = chick_run;
  self.monsterinfo.dodge = chick_dodge;
  self.monsterinfo.attack = chick_attack;
  self.monsterinfo.melee = chick_melee;
  self.monsterinfo.sight = (s, o) => {
      context.entities.sound?.(s, 0, 'chick/chksght1.wav', 1, 1, 0);
  };
  self.monsterinfo.blocked = chick_blocked;

  self.think = monster_think;

  context.entities.linkentity(self);

  chick_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerChickSpawns(registry: SpawnRegistry): void {
  registry.register('monster_chick', SP_monster_chick);
}
