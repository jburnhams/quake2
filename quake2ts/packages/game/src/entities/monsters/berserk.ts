import {
  angleVectors,
  createRandomGenerator,
  normalizeVec3,
  scaleVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  ServerCommand,
  TempEntity,
  vectorToAngles
} from '@quake2ts/shared';
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
  Solid
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { T_Damage, T_RadiusDamage } from '../../combat/damage.js';
import { DamageMod } from '../../combat/damageMods.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { throwGibs } from '../gibs.js';
import { AIFlags, SPAWNFLAG_MONSTER_AMBUSH } from '../../ai/constants.js';
import { EntitySystem } from '../system.js';
import { MulticastType } from '../../imports.js';
import { rangeTo } from '../../ai/perception.js';

const MONSTER_TICK = 0.1;
const MELEE_DISTANCE = 80;
const SPAWNFLAG_BERSERK_NOJUMPING = 16;

// Wrappers to match function signatures
function monster_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
  ai_stand(self, MONSTER_TICK, context);
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

// Sound constants
const SOUNDS = {
  pain: 'berserk/berpain2.wav',
  die: 'berserk/berdeth2.wav',
  idle: 'berserk/beridle1.wav',
  idle2: 'berserk/idle.wav',
  punch: 'berserk/attack.wav',
  search: 'berserk/bersrch1.wav',
  sight: 'berserk/sight.wav',
  thud: 'mutant/thud1.wav',
  explod: 'world/explod2.wav',
  jump: 'berserk/jump.wav',
  footstep: 'misc/step1.wav'
};

function monster_footstep(self: Entity, context: EntitySystem): void {
  context.sound(self, 2, SOUNDS.footstep, 1, 1, 0);
}

function M_SetAnimation(self: Entity, move: MonsterMove): void {
  self.monsterinfo.current_move = move;
  self.monsterinfo.nextframe = move.firstframe;
  self.frame = move.firstframe;
  self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
}

function monster_done_dodge(self: Entity, context: EntitySystem): void {
  // Placeholder
}

// Forward declarations
let berserk_move_stand: MonsterMove;
let berserk_move_stand_fidget: MonsterMove;
let berserk_move_walk: MonsterMove;
let berserk_move_run1: MonsterMove;
let berserk_move_attack_spike: MonsterMove;
let berserk_move_attack_club: MonsterMove;
let berserk_move_attack_strike: MonsterMove;
let berserk_move_run_attack1: MonsterMove;
let berserk_move_pain1: MonsterMove;
let berserk_move_pain2: MonsterMove;
let berserk_move_death1: MonsterMove;
let berserk_move_death2: MonsterMove;

// STAND

function berserk_stand(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, berserk_move_stand);
}

function berserk_fidget(self: Entity, context: EntitySystem): void {
  if (self.monsterinfo.aiflags & AIFlags.StandGround) return;
  if (self.enemy) return;
  if (context.game.random.frandom() > 0.15) return;

  M_SetAnimation(self, berserk_move_stand_fidget);
  context.sound(self, 1, SOUNDS.idle, 1, 2, 0);
}

const berserk_frames_stand: MonsterFrame[] = [
  { ai: monster_ai_stand, dist: 0, think: berserk_fidget },
  { ai: monster_ai_stand, dist: 0 },
  { ai: monster_ai_stand, dist: 0 },
  { ai: monster_ai_stand, dist: 0 },
  { ai: monster_ai_stand, dist: 0 }
];

berserk_move_stand = {
  firstframe: 0,
  lastframe: 4,
  frames: berserk_frames_stand,
  endfunc: null
};

const berserk_frames_stand_fidget: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_stand, dist: 0
}));

berserk_move_stand_fidget = {
  firstframe: 5,
  lastframe: 24,
  frames: berserk_frames_stand_fidget,
  endfunc: berserk_stand
};

// WALK

const berserk_frames_walk: MonsterFrame[] = [
  { ai: monster_ai_walk, dist: 9.1 },
  { ai: monster_ai_walk, dist: 6.3 },
  { ai: monster_ai_walk, dist: 4.9 },
  { ai: monster_ai_walk, dist: 6.7, think: monster_footstep },
  { ai: monster_ai_walk, dist: 6.0 },
  { ai: monster_ai_walk, dist: 8.2 },
  { ai: monster_ai_walk, dist: 7.2 },
  { ai: monster_ai_walk, dist: 6.1 },
  { ai: monster_ai_walk, dist: 4.9 },
  { ai: monster_ai_walk, dist: 4.7, think: monster_footstep },
  { ai: monster_ai_walk, dist: 4.7 }
];

berserk_move_walk = {
  firstframe: 25,
  lastframe: 35,
  frames: berserk_frames_walk,
  endfunc: null
};

function berserk_walk(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, berserk_move_walk);
}

// RUN

const berserk_frames_run1: MonsterFrame[] = [
  { ai: monster_ai_run, dist: 21 },
  { ai: monster_ai_run, dist: 11, think: monster_footstep },
  { ai: monster_ai_run, dist: 21 },
  { ai: monster_ai_run, dist: 25, think: monster_done_dodge },
  { ai: monster_ai_run, dist: 18, think: monster_footstep },
  { ai: monster_ai_run, dist: 19 }
];

berserk_move_run1 = {
  firstframe: 36,
  lastframe: 41,
  frames: berserk_frames_run1,
  endfunc: null
};

function berserk_run(self: Entity, context: EntitySystem): void {
  monster_done_dodge(self, context);
  if (self.monsterinfo.aiflags & AIFlags.StandGround) {
    M_SetAnimation(self, berserk_move_stand);
  } else {
    M_SetAnimation(self, berserk_move_run1);
  }
}

// ATTACK

function fire_hit(self: Entity, aim: Vec3, damage: number, kick: number, context: EntitySystem): boolean {
  const start: Vec3 = {
    x: self.origin.x,
    y: self.origin.y,
    z: self.origin.z + self.viewheight
  };
  const forward = angleVectors(self.angles).forward;

  const end: Vec3 = {
    x: start.x + forward.x + aim.x,
    y: start.y + forward.y + aim.y,
    z: start.z + forward.z + aim.z
  };

  const endTrace: Vec3 = {
      x: start.x + forward.x * MELEE_DISTANCE,
      y: start.y + forward.y * MELEE_DISTANCE,
      z: start.z + forward.z * MELEE_DISTANCE
  };

  const tr = context.trace(start, null, null, endTrace, self, 0x1 | 0x20000000); // MASK_SHOT
  if (!tr.ent || !tr.ent.takedamage) return false;

  T_Damage(
    tr.ent as any,
    self as any,
    self as any,
    forward,
    tr.endpos,
    tr.plane?.normal || ZERO_VEC3,
    damage,
    kick,
    DamageFlags.NONE,
    DamageMod.UNKNOWN,
    context.timeSeconds,
    context.multicast.bind(context)
  );
  return true;
}

function berserk_attack_spike(self: Entity, context: EntitySystem): void {
  if (!fire_hit(self, {x: MELEE_DISTANCE, y: 0, z: -24}, 5 + Math.floor(context.game.random.frandom() * 7), 80, context)) {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 1.2;
  }
}

function berserk_swing(self: Entity, context: EntitySystem): void {
  context.sound(self, 1, SOUNDS.punch, 1, 1, 0);
}

const berserk_frames_attack_spike: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: berserk_swing },
  { ai: monster_ai_charge, dist: 0, think: berserk_attack_spike },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 }
];

berserk_move_attack_spike = {
  firstframe: 67,
  lastframe: 74,
  frames: berserk_frames_attack_spike,
  endfunc: berserk_run
};

function berserk_attack_club(self: Entity, context: EntitySystem): void {
  if (!fire_hit(self, {x: MELEE_DISTANCE, y: 0, z: -4}, 15 + Math.floor(context.game.random.frandom() * 7), 400, context)) {
    self.monsterinfo.melee_debounce_time = context.timeSeconds + 2.5;
  }
}

const berserk_frames_attack_club: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: monster_footstep },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: berserk_swing },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0, think: berserk_attack_club },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 }
];

berserk_move_attack_club = {
  firstframe: 75,
  lastframe: 86,
  frames: berserk_frames_attack_club,
  endfunc: berserk_run
};

// SLAM / JUMP ATTACK

function T_SlamRadiusDamage(inflictor: Entity, attacker: Entity, damage: number, radius: number, kick: number, context: EntitySystem): void {
  const entities = context.findByRadius(inflictor.origin, radius);

  for (const ent of entities) {
    if (ent === inflictor) continue;
    if (!ent.takedamage) continue;

    // Distance calculation
    const dist = Math.sqrt(
      Math.pow(ent.origin.x - inflictor.origin.x, 2) +
      Math.pow(ent.origin.y - inflictor.origin.y, 2) +
      Math.pow(ent.origin.z - inflictor.origin.z, 2)
    );

    const amount = Math.max(0, 1.0 - (dist / radius));
    if (amount <= 0) continue;

    const points = Math.max(1, damage * amount * amount);
    const k = kick * amount * amount;

    const dir = normalizeVec3(subtractVec3(ent.origin, inflictor.origin));

    T_Damage(ent as any, inflictor as any, attacker as any, dir, ent.origin, dir, points, k, DamageFlags.RADIUS, DamageMod.UNKNOWN, context.timeSeconds, context.multicast.bind(context));

    // Kick upwards
    if (ent.client) {
      ent.velocity = { ...ent.velocity, z: Math.max(270, ent.velocity.z) };
    }
  }
}

function berserk_attack_slam(self: Entity, context: EntitySystem): void {
  context.sound(self, 1, SOUNDS.thud, 1, 1, 0);
  context.sound(self, 2, SOUNDS.explod, 0.75, 1, 0);

  // Visual effect
  const { forward, right } = angleVectors(self.angles);
  const flashOffset = { x: 20, y: -14.3, z: -21 };
  const start = {
      x: self.origin.x + forward.x * flashOffset.x + right.x * flashOffset.y,
      y: self.origin.y + forward.y * flashOffset.x + right.y * flashOffset.y,
      z: self.origin.z + forward.z * flashOffset.x + right.z * flashOffset.y + flashOffset.z
  };
  const tr = context.trace(self.origin, null, null, start, self, 1); // MASK_SOLID

  context.multicast(tr.endpos, MulticastType.Phs, ServerCommand.temp_entity, TempEntity.BERSERK_SLAM, tr.endpos);

  self.gravity = 1.0;
  self.velocity = {x:0, y:0, z:0};

  // Use the new radius damage function
  T_SlamRadiusDamage(self, self, 8, 165, 300, context);
}

function berserk_jump_touch(self: Entity, other: Entity | null, plane: any, surf: any, context: EntitySystem): void {
  if (self.health <= 0) {
    self.touch = undefined;
    return;
  }

  // If we hit something while jumping, do slam damage immediately if appropriate
  if (other && other.takedamage) {
     self.touch = undefined;
     berserk_attack_slam(self, context);
  }
}

function berserk_high_gravity(self: Entity, context: EntitySystem): void {
  const base = 800;
  if (self.velocity.z < 0) {
    self.gravity = 2.25 * (800 / base);
  } else {
    self.gravity = 5.25 * (800 / base);
  }
}

function berserk_jump_takeoff(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  const diff = subtractVec3(self.enemy.origin, self.origin);
  const dist = Math.sqrt(diff.x*diff.x + diff.y*diff.y + diff.z*diff.z);
  const fwd_speed = dist * 1.95;

  const forward = normalizeVec3({x: diff.x, y: diff.y, z: 0});
  const angles = vectorToAngles(forward);
  self.angles = { x: self.angles.x, y: angles.y, z: self.angles.z };

  const origin = { ...self.origin };
  origin.z += 1;
  self.origin = origin;

  self.velocity = {
    x: forward.x * fwd_speed,
    y: forward.y * fwd_speed,
    z: 450
  };
  self.groundentity = null;
  self.monsterinfo.aiflags |= AIFlags.Ducked;
  self.monsterinfo.attack_finished = context.timeSeconds + 3.0;

  // Bind context to callback
  self.touch = (s, o, p, su) => {
      berserk_jump_touch(s, o, p, su, context);
      if (s.groundentity) {
          s.frame = 104;
          berserk_attack_slam(s, context);
          s.touch = undefined;
      }
  };

  berserk_high_gravity(self, context);
}

function berserk_check_landing(self: Entity, context: EntitySystem): void {
  berserk_high_gravity(self, context);
  if (self.groundentity) {
    self.monsterinfo.attack_finished = 0;
    self.monsterinfo.aiflags &= ~AIFlags.Ducked;
    self.frame = 104; // FRAME_slam18
    if (self.touch) {
      berserk_attack_slam(self, context);
      self.touch = undefined;
    }
    return;
  }

  if (context.timeSeconds > (self.monsterinfo.attack_finished || 0)) {
    self.monsterinfo.nextframe = 89; // FRAME_slam3
  } else {
    self.monsterinfo.nextframe = 91; // FRAME_slam5
  }
}

const berserk_frames_attack_strike: MonsterFrame[] = [
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_charge, dist: 0 },
  { ai: monster_ai_move, dist: 0, think: berserk_jump_takeoff },
  { ai: monster_ai_move, dist: 0, think: berserk_high_gravity },
  { ai: monster_ai_move, dist: 0, think: berserk_check_landing },
  { ai: monster_ai_move, dist: 0, think: monster_footstep },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0, think: monster_footstep },
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
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0, think: monster_footstep }
];

berserk_move_attack_strike = {
  firstframe: 87,
  lastframe: 109,
  frames: berserk_frames_attack_strike,
  endfunc: berserk_run
};

function berserk_melee(self: Entity, context: EntitySystem): void {
  if (context.game.random.frandom() > 0.5) {
    M_SetAnimation(self, berserk_move_attack_spike);
  } else {
    M_SetAnimation(self, berserk_move_attack_club);
  }
}

function berserk_attack(self: Entity, context: EntitySystem): void {
  const dist = self.enemy ? rangeTo(self, self.enemy) : 1000;

  if ((self.monsterinfo.melee_debounce_time || 0) <= context.timeSeconds && dist < MELEE_DISTANCE) {
    berserk_melee(self, context);
  } else if (self.timestamp < context.timeSeconds && context.game.random.frandom() > 0.5 && dist > 150) {
    // Check for NOJUMPING flag
    if (self.spawnflags & SPAWNFLAG_BERSERK_NOJUMPING) return;

    M_SetAnimation(self, berserk_move_attack_strike);
    context.sound(self, 1, SOUNDS.jump, 1, 1, 0);
    self.timestamp = context.timeSeconds + 5.0;
  }
}

// PAIN

const berserk_frames_pain1: MonsterFrame[] = [
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 }
];

berserk_move_pain1 = {
  firstframe: 149,
  lastframe: 152,
  frames: berserk_frames_pain1,
  endfunc: berserk_run
};

const berserk_frames_pain2: MonsterFrame[] = Array.from({ length: 20 }, (_, i) => ({
  ai: monster_ai_move, dist: 0, think: (i % 5 === 4) ? monster_footstep : undefined
}));

berserk_move_pain2 = {
  firstframe: 153,
  lastframe: 172,
  frames: berserk_frames_pain2,
  endfunc: berserk_run
};

function berserk_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
  if (self.monsterinfo.current_move === berserk_move_attack_strike) return;

  if (context.timeSeconds < self.pain_debounce_time) return;

  self.pain_debounce_time = context.timeSeconds + 3.0;
  context.sound(self, 2, SOUNDS.pain, 1, 1, 0);

  if (damage <= 50 || context.game.random.frandom() < 0.5) {
    M_SetAnimation(self, berserk_move_pain1);
  } else {
    M_SetAnimation(self, berserk_move_pain2);
  }
}

// DEATH

function berserk_dead(self: Entity, context: EntitySystem): void {
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: -8 };
  self.monsterinfo.nextframe = berserk_move_death1.lastframe;
  self.nextthink = -1;
  self.deadflag = DeadFlag.Dead;
}

const berserk_frames_death1: MonsterFrame[] = [
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0, think: monster_footstep },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 }
];

berserk_move_death1 = {
  firstframe: 173,
  lastframe: 185,
  frames: berserk_frames_death1,
  endfunc: berserk_dead
};

const berserk_frames_death2: MonsterFrame[] = [
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0, think: monster_footstep },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 },
  { ai: monster_ai_move, dist: 0 }
];

berserk_move_death2 = {
  firstframe: 186,
  lastframe: 193,
  frames: berserk_frames_death2,
  endfunc: berserk_dead
};

function berserk_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: EntitySystem): void {
  if (self.health <= -60) { // gib_health
    context.sound(self, 2, "misc/udeath.wav", 1, 1, 0);
    throwGibs(context, self.origin, damage);
    context.free(self);
    return;
  }

  if (self.deadflag === DeadFlag.Dead) return;

  context.sound(self, 2, SOUNDS.die, 1, 1, 0);
  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;

  if (damage >= 50) {
    M_SetAnimation(self, berserk_move_death1);
  } else {
    M_SetAnimation(self, berserk_move_death2);
  }
}

function berserk_sight(self: Entity, other: Entity): void {
  // We need context to play sound, but MonsterSightCallback signature is (self, enemy)
  // We can't access context here unless we bind it or change signature.
  // However, we can't change signature easily as it's defined in Entity.
  // Let's assume we can't play sight sound yet or need a workaround.
  // Actually, we can get context if we change how sight is called or if we attach context to entity (bad practice).
  // Or we can use a closure when assigning.
}

function berserk_search(self: Entity, context: EntitySystem): void {
  if (context.game.random.frandom() > 0.5) {
    context.sound(self, 2, SOUNDS.idle2, 1, 1, 0);
  } else {
    context.sound(self, 2, SOUNDS.search, 1, 1, 0);
  }
}

export function SP_monster_berserk(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_berserk';
  self.model = 'models/monsters/berserk/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 240 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 250;
  self.takedamage = true;

  self.pain = (s, o, k, d) => berserk_pain(s, o, k, d, context.entities);
  self.die = (s, i, a, d, p) => berserk_die(s, i, a, d, p, context.entities);

  self.monsterinfo.stand = berserk_stand;
  self.monsterinfo.walk = berserk_walk;
  self.monsterinfo.run = berserk_run;
  self.monsterinfo.attack = berserk_attack;
  self.monsterinfo.melee = berserk_melee;
  self.monsterinfo.sight = (s, o) => {
      context.entities.sound(s, 2, SOUNDS.sight, 1, 1, 0);
  };
  self.monsterinfo.search = berserk_search;

  self.think = monster_think;

  context.entities.linkentity(self);

  berserk_stand(self, context.entities);
  self.nextthink = context.entities.timeSeconds + MONSTER_TICK;
}

export function registerBerserkSpawns(registry: SpawnRegistry): void {
  registry.register('monster_berserk', SP_monster_berserk);
}
