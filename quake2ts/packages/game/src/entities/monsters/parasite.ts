import {
  angleVectors,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  lengthVec3,
  scaleVec3,
  addVec3,
  vectorToAngles,
  copyVec3,
  ServerCommand,
  TempEntity,
  MASK_SHOT
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think
} from '../../ai/index.js';
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
import type { EntitySystem } from '../system.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';

const MONSTER_TICK = 0.1;

// Helper to access deterministic RNG or Math.random
const random = Math.random;

// Wrappers for AI functions
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
let drain_move: MonsterMove;
let pain_move: MonsterMove;
let death_move: MonsterMove;
let start_run_move: MonsterMove;
let start_walk_move: MonsterMove;
let start_fidget_move: MonsterMove;
let fidget_move: MonsterMove;
let end_fidget_move: MonsterMove;

// Sounds (indices to be resolved at spawn)
let sound_pain1: number;
let sound_pain2: number;
let sound_die: number;
let sound_launch: number;
let sound_impact: number;
let sound_suck: number;
let sound_reelin: number;
let sound_sight: number;
let sound_tap: number;
let sound_scratch: number;
let sound_search: number;

function parasite_launch(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'parasite/paratck1.wav', 1, 1, 0);
}

function parasite_reel_in(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'parasite/paratck4.wav', 1, 1, 0);
}

function parasite_sight(self: Entity, other: Entity): void {
  // Sound handled in monsterinfo closure now
}

function parasite_tap(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'parasite/paridle1.wav', 1, 2, 0);
}

function parasite_scratch(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'parasite/paridle2.wav', 1, 2, 0);
}

function parasite_search(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, 'parasite/parsrch1.wav', 1, 2, 0);
}

// Fidget Logic
function parasite_do_fidget(self: Entity): void {
  self.monsterinfo.current_move = fidget_move;
}

function parasite_refidget(self: Entity): void {
  if (random() <= 0.8) {
    self.monsterinfo.current_move = fidget_move;
  } else {
    self.monsterinfo.current_move = end_fidget_move;
  }
}

function parasite_end_fidget(self: Entity): void {
  self.monsterinfo.current_move = end_fidget_move;
}

function parasite_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function parasite_idle(self: Entity): void {
  self.monsterinfo.current_move = start_fidget_move;
}

function parasite_start_walk(self: Entity): void {
  self.monsterinfo.current_move = start_walk_move;
}

function parasite_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function parasite_start_run(self: Entity): void {
  self.monsterinfo.current_move = start_run_move;
}

function parasite_run(self: Entity): void {
    if (self.monsterinfo.aiflags && (self.monsterinfo.aiflags & 1)) {
        self.monsterinfo.current_move = stand_move;
    } else {
        self.monsterinfo.current_move = run_move;
    }
}

function parasite_drain_attack_ok(start: Vec3, end: Vec3): boolean {
  const dir = subtractVec3(end, start);
  const dist = lengthVec3(dir);
  if (dist > 256) return false;

  const angles = vectorToAngles(dir);
  let pitch = angles.x;
  // Normalize pitch
  if (pitch < -180) pitch += 360;

  if (Math.abs(pitch) > 30) return false;

  return true;
}

function parasite_drain_attack(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  const vectors = angleVectors(self.angles);
  const f = vectors.forward;
  const r = vectors.right;
  const u = vectors.up;

  const offset = { x: 24, y: 0, z: 6 };
  const start = addVec3(
      self.origin,
      addVec3(
          scaleVec3(f, offset.x),
          addVec3(scaleVec3(r, offset.y), scaleVec3(u, offset.z))
      )
  );

  let end = copyVec3(self.enemy.origin);

  if (!parasite_drain_attack_ok(start, end)) {
    end = { ...end, z: self.enemy.origin.z + self.enemy.maxs.z - 8 };
    if (!parasite_drain_attack_ok(start, end)) {
      end = { ...end, z: self.enemy.origin.z + self.enemy.mins.z + 8 };
      if (!parasite_drain_attack_ok(start, end)) {
        return;
      }
    }
  }

  const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, MASK_SHOT);

  if (tr.ent !== self.enemy) {
    return;
  }

  let damage = 2;
  const currentFrame = self.frame;

  // FRAME_drain03 is 41 (index 2 relative to 39)
  if (currentFrame === 41) {
    damage = 5;
    context.engine.sound?.(self.enemy, 0, 'parasite/paratck2.wav', 1, 1, 0);
  } else {
    // FRAME_drain04 is 42
    if (currentFrame === 42) {
      context.engine.sound?.(self, 0, 'parasite/paratck3.wav', 1, 1, 0);
    }
    damage = 2;
  }

  context.multicast(self.origin, 0 /* MulticastType.PVS */, ServerCommand.temp_entity, {
    te: TempEntity.PARASITE_ATTACK,
    entId: self.index,
    start: start,
    end: end
  } as any);

  const dir = normalizeVec3(subtractVec3(start, end));

  T_Damage(
    self.enemy as unknown as Damageable,
    self as unknown as Damageable,
    self as unknown as Damageable,
    dir,
    self.enemy.origin,
    ZERO_VEC3,
    damage,
    0,
    DamageFlags.NO_KNOCKBACK,
    DamageMod.UNKNOWN
  );

  // Heal self
  if (self.health < self.max_health) {
    self.health += damage;
    if (self.health > self.max_health) {
      self.health = self.max_health;
    }
  }
}

function parasite_attack(self: Entity): void {
  self.monsterinfo.current_move = drain_move;
}

function parasite_pain_func(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  }

  if (self.timestamp < (self.pain_finished_time || 0)) return;

  self.pain_finished_time = self.timestamp + 3;

  if (random() < 0.5) {
      context.engine.sound?.(self, 0, 'parasite/parpain1.wav', 1, 1, 0);
  } else {
      context.engine.sound?.(self, 0, 'parasite/parpain2.wav', 1, 1, 0);
  }

  self.monsterinfo.current_move = pain_move;
}

function parasite_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function parasite_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
}

// ----------------------------------------------------------------------
// FRAMES & MOVES
// ----------------------------------------------------------------------

const stand_frames: MonsterFrame[] = [
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_tap }
];

stand_move = {
    firstframe: 83,
    lastframe: 99,
    frames: stand_frames,
    endfunc: parasite_stand
};

const start_fidget_frames: MonsterFrame[] = [
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 }
];

start_fidget_move = {
    firstframe: 100,
    lastframe: 103,
    frames: start_fidget_frames,
    endfunc: parasite_do_fidget
};

const fidget_frames: MonsterFrame[] = [
    { ai: monster_ai_stand, dist: 0, think: parasite_scratch },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0, think: parasite_scratch },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 }
];

fidget_move = {
    firstframe: 104,
    lastframe: 109,
    frames: fidget_frames,
    endfunc: parasite_refidget
};

const end_fidget_frames: MonsterFrame[] = [
    { ai: monster_ai_stand, dist: 0, think: parasite_scratch },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 },
    { ai: monster_ai_stand, dist: 0 }
];

end_fidget_move = {
    firstframe: 110,
    lastframe: 117,
    frames: end_fidget_frames,
    endfunc: parasite_stand
};

const start_run_frames: MonsterFrame[] = [
    { ai: monster_ai_run, dist: 0 },
    { ai: monster_ai_run, dist: 30 }
];

start_run_move = {
    firstframe: 68,
    lastframe: 69,
    frames: start_run_frames,
    endfunc: parasite_run
};

const run_frames: MonsterFrame[] = [
    { ai: monster_ai_run, dist: 30 },
    { ai: monster_ai_run, dist: 30 },
    { ai: monster_ai_run, dist: 22 },
    { ai: monster_ai_run, dist: 19 },
    { ai: monster_ai_run, dist: 24 },
    { ai: monster_ai_run, dist: 28 },
    { ai: monster_ai_run, dist: 25 }
];

run_move = {
    firstframe: 70,
    lastframe: 76,
    frames: run_frames,
    endfunc: parasite_run
};

const start_walk_frames: MonsterFrame[] = [
    { ai: monster_ai_walk, dist: 0 },
    { ai: monster_ai_walk, dist: 30, think: parasite_walk }
];

start_walk_move = {
    firstframe: 68,
    lastframe: 69,
    frames: start_walk_frames,
    endfunc: parasite_walk
};

const walk_frames: MonsterFrame[] = [
    { ai: monster_ai_walk, dist: 30 },
    { ai: monster_ai_walk, dist: 30 },
    { ai: monster_ai_walk, dist: 22 },
    { ai: monster_ai_walk, dist: 19 },
    { ai: monster_ai_walk, dist: 24 },
    { ai: monster_ai_walk, dist: 28 },
    { ai: monster_ai_walk, dist: 25 }
];

walk_move = {
    firstframe: 70,
    lastframe: 76,
    frames: walk_frames,
    endfunc: parasite_walk
};

const pain_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 6 },
    { ai: monster_ai_move, dist: 16 },
    { ai: monster_ai_move, dist: -6 },
    { ai: monster_ai_move, dist: -7 },
    { ai: monster_ai_move, dist: 0 }
];

pain_move = {
    firstframe: 57,
    lastframe: 67,
    frames: pain_frames,
    endfunc: parasite_start_run
};

const drain_frames: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0, think: parasite_launch },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 15, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: -2, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: -2, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: -3, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: -2, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: -1, think: parasite_drain_attack },
    { ai: monster_ai_charge, dist: 0, think: parasite_reel_in },
    { ai: monster_ai_charge, dist: -2 },
    { ai: monster_ai_charge, dist: -2 },
    { ai: monster_ai_charge, dist: -3 },
    { ai: monster_ai_charge, dist: 0 }
];

drain_move = {
    firstframe: 39,
    lastframe: 56,
    frames: drain_frames,
    endfunc: parasite_start_run
};

const death_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 }
];

death_move = {
    firstframe: 32,
    lastframe: 38,
    frames: death_frames,
    endfunc: parasite_dead
};


export function SP_monster_parasite(self: Entity, context: SpawnContext): void {
  // Removing soundIndex calls as they caused build errors and are optional/implicit in string usage.

  self.model = 'models/monsters/parasite/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 24 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 175;
  self.max_health = 175;
  self.mass = 250;
  self.takedamage = true;

  self.pain = (ent, other, kick, dmg) => {
    parasite_pain_func(ent, other, kick, dmg, context.entities);
  };

  self.die = (ent, inflictor, attacker, damage, point) => {
    ent.deadflag = DeadFlag.Dead;
    ent.solid = Solid.Not;

    if (ent.health < -50) {
        throwGibs(context.entities, ent.origin, damage);
        context.entities.free(ent);
        return;
    }

    context.entities.engine.sound?.(ent, 0, 'parasite/pardeth1.wav', 1, 1, 0);
    ent.takedamage = true;
    parasite_die(ent);
  };

  self.monsterinfo.stand = parasite_stand;
  self.monsterinfo.walk = parasite_start_walk;
  self.monsterinfo.run = parasite_start_run;
  self.monsterinfo.attack = parasite_attack;
  self.monsterinfo.sight = (ent, other) => {
    parasite_sight(ent, other);
    context.entities.engine.sound?.(ent, 0, 'parasite/parsght1.wav', 1, 1, 0);
  };
  self.monsterinfo.idle = parasite_idle;

  self.think = monster_think;

  parasite_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerParasiteSpawns(registry: SpawnRegistry): void {
  registry.register('monster_parasite', SP_monster_parasite);
}
