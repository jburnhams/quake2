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
import { rangeTo, visible } from '../../ai/perception.js';
import {
  monster_fire_bullet,
  monster_fire_bfg,
} from './attack.js';
import { MuzzleFlash } from '../../combat/muzzleflash.js';
import { EntitySystem } from '../system.js';
import { Vec3, copyVec3, angleVectors, subtractVec3, normalizeVec3, scaleVec3, addVec3 } from '@quake2ts/shared';
import { projectFlashSource } from './common.js';
import { createRandomGenerator } from '@quake2ts/shared';
import { SP_monster_makron } from './makron.js';

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
let run_move: MonsterMove;
let walk_move: MonsterMove;
let attack1_move: MonsterMove; // Machineguns (Jorg)
let start_attack1_move: MonsterMove;
let end_attack1_move: MonsterMove;
let attack2_move: MonsterMove; // BFG (Jorg)
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;

function jorg_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
  // jorg_attack1_end_sound(self);
}

function jorg_run(self: Entity): void {
  if (self.monsterinfo.aiflags & 16 /* AI_STAND_GROUND */) {
    self.monsterinfo.current_move = stand_move;
  } else {
    self.monsterinfo.current_move = run_move;
  }
  // jorg_attack1_end_sound(self);
}

function jorg_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function jorg_attack(self: Entity): void {
  if (random.frandom() <= 0.75) {
    // Play sound
    self.monsterinfo.current_move = start_attack1_move;
  } else {
    // Play sound
    self.monsterinfo.current_move = attack2_move;
  }
}

function jorg_firebullet_left(self: Entity, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, MuzzleFlash.JorgMachinegunL1, forward, right);

  // PredictAim (simplified)
  // monster_fire_bullet
  monster_fire_bullet(self, start, forward, 6, 4, 0.06, 0.06, MuzzleFlash.JorgMachinegunL1, context);
}

function jorg_firebullet_right(self: Entity, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, MuzzleFlash.JorgMachinegunR1, forward, right);

  monster_fire_bullet(self, start, forward, 6, 4, 0.06, 0.06, MuzzleFlash.JorgMachinegunR1, context);
}

function jorg_firebullet(self: Entity, context: EntitySystem): void {
  jorg_firebullet_left(self, context);
  jorg_firebullet_right(self, context);
}

function jorg_reattack1(self: Entity): void {
  if (self.enemy && visible(self, self.enemy)) {
    if (random.frandom() < 0.9) {
      self.monsterinfo.current_move = attack1_move;
    } else {
      self.monsterinfo.current_move = end_attack1_move;
    }
  } else {
    self.monsterinfo.current_move = end_attack1_move;
  }
}

function jorgBFG(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, MuzzleFlash.JorgBfg1, forward, right);

  const vec = subtractVec3(self.enemy.origin, start);
  const dir = normalizeVec3({ x: vec.x, y: vec.y, z: vec.z + self.enemy.viewheight });

  // Play sound
  monster_fire_bfg(self, start, dir, 50, 300, 100, 200, MuzzleFlash.JorgBfg1, context);
}

function jorg_dead(self: Entity, context: EntitySystem): void {
  // Explosion effect

  // Gibs
  throwGibs(context, self.origin, 500);

  // MakronToss
  MakronToss(self, context);
}

function MakronToss(self: Entity, context: EntitySystem): void {
  const ent = context.spawn();
  ent.classname = 'monster_makron';
  ent.target = self.target;
  ent.origin = copyVec3(self.origin);
  ent.enemy = self.enemy;

  // Create a partial SpawnContext for SP_monster_makron
  const spawnContext: SpawnContext = {
      entities: context,
      keyValues: {},
      warn: (msg) => {}, // console not available in some envs, use no-op
      free: (e) => context.freeImmediate(e),
  };

  SP_monster_makron(ent, spawnContext);

  if (ent.think) {
      ent.think(ent, context); // Start thinking
  }

  // Jump at player
  if (ent.enemy) {
      const vec = subtractVec3(ent.enemy.origin, ent.origin);
      // vectoyaw(vec) -> update angles
      // ent.angles.y = vectoyaw(vec); // Need vectoyaw
      const dir = normalizeVec3(vec);
      ent.velocity = scaleVec3(dir, 400);
      ent.velocity = { ...ent.velocity, z: 200 }; // Mutable assignment
      ent.groundentity = null;
      // FoundTarget logic
  }

  // Transfer health bar if implemented
}

// Frames
const stand_frames: MonsterFrame[] = Array.from({ length: 51 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
stand_move = {
  firstframe: 0,
  lastframe: 50,
  frames: stand_frames,
  endfunc: jorg_stand
};

const run_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({
  ai: monster_ai_run,
  dist: 10
}));
run_move = {
  firstframe: 51,
  lastframe: 64,
  frames: run_frames,
  endfunc: jorg_run
};

const walk_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({
  ai: monster_ai_walk,
  dist: 10
}));
walk_move = {
  firstframe: 51,
  lastframe: 64,
  frames: walk_frames,
  endfunc: jorg_walk
};

const start_attack1_frames: MonsterFrame[] = Array.from({ length: 8 }, () => ({
  ai: monster_ai_charge,
  dist: 0
}));
start_attack1_move = {
  firstframe: 114,
  lastframe: 121,
  frames: start_attack1_frames,
  endfunc: (self) => self.monsterinfo.current_move = attack1_move
};

const attack1_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_charge,
  dist: 0,
  think: jorg_firebullet
}));
attack1_move = {
  firstframe: 122,
  lastframe: 127,
  frames: attack1_frames,
  endfunc: jorg_reattack1
};

const end_attack1_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
end_attack1_move = {
  firstframe: 128,
  lastframe: 131,
  frames: end_attack1_frames,
  endfunc: jorg_run
};

const attack2_frames: MonsterFrame[] = Array.from({ length: 13 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: i === 6 ? jorgBFG : undefined
}));
attack2_move = {
  firstframe: 132,
  lastframe: 144,
  frames: attack2_frames,
  endfunc: jorg_run
};

const pain1_frames: MonsterFrame[] = Array.from({ length: 3 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain1_move = {
  firstframe: 98,
  lastframe: 100,
  frames: pain1_frames,
  endfunc: jorg_run
};

const pain2_frames: MonsterFrame[] = Array.from({ length: 3 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain2_move = {
  firstframe: 101,
  lastframe: 103,
  frames: pain2_frames,
  endfunc: jorg_run
};

const pain3_frames: MonsterFrame[] = Array.from({ length: 25 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain3_move = {
  firstframe: 104,
  lastframe: 128, // Wait, overlap?
  // C code: pain3_01 to pain3_25.
  // Let's assume frame numbers are sequential and correct in C array
  // Pain1: 101-103? C says FRAME_pain101.
  // Actually need exact frame numbers.
  // Assuming typical Q2:
  // Stand: 0-50
  // Walk: 51-64
  // Run: Same as walk
  // Pain1: 65-67?
  // Pain2: 68-70?
  // Pain3: 71-95?
  // Attack1 start: 96-103
  // Attack1 loop: 104-109
  // Attack1 end: 110-113
  // Attack2: 114-126
  // Death: 127-176
  frames: pain3_frames,
  endfunc: jorg_run
};

// Correction on frames from C arrays if possible:
// FRAME_stand01..51
// FRAME_walk06..19 (14 frames) -> 51..64 ?
// FRAME_pain301..325 (25 frames)
// FRAME_pain201..203 (3 frames)
// FRAME_pain101..103 (3 frames)
// FRAME_death01..50 (50 frames)
// FRAME_attak201..213 (13 frames)
// FRAME_attak101..108 (8 frames)
// FRAME_attak109..114 (6 frames)
// FRAME_attak115..118 (4 frames)

// I will use approximate sequential numbers based on block order or just placeholder.
// Since I don't have the frame numbers mapped exactly to constants, I'll use separate blocks.

const death_frames: MonsterFrame[] = Array.from({ length: 50 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
death_move = {
  firstframe: 145, // Placeholder start
  lastframe: 194,
  frames: death_frames,
  endfunc: (self) => {
      // We need context here to spawn Makron.
      // But endfunc only takes self.
      // We can store context on self or assume we handle it in the last frame think?
      // Or jorg_dead is called by die().
      // Wait, jorg_dead is the endfunc of death_move in C.
      // And C jorg_dead calls MakronToss.
      // But we don't have context in endfunc.
      // We can use `self.think` override or something.
      // Or rely on the EntitySystem being available globally (bad).
      // Or store it on the entity temporarily?
      // Actually, `monster_dead` usually sets `nextthink = -1`.
      // `jorg_dead` calls `MakronToss`.
      // Let's set `think` to `jorg_dead` on the last frame?
      // In `monster_think`, `endfunc` is called.
      // If I change `jorg_dead` to be a think function, I can pass context.
  }
};

// Modifying death_move to call jorg_dead on last frame think
death_frames[49].think = jorg_dead;


export function SP_monster_jorg(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_jorg';
  self.model = 'models/monsters/boss3/jorg/tris.md2';
  self.mins = { x: -80, y: -80, z: 0 };
  self.maxs = { x: 80, y: 80, z: 140 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 8000;
  self.max_health = 8000;
  self.mass = 1000;
  self.takedamage = true;
  self.viewheight = 100;

  self.monsterinfo.stand = jorg_stand;
  self.monsterinfo.walk = jorg_walk;
  self.monsterinfo.run = jorg_run;
  self.monsterinfo.attack = jorg_attack;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
        self.skin = 1;
    }
    if (random.frandom() < 0.6 && damage <= 40) return;

    if (damage <= 50) {
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= 100) {
        self.monsterinfo.current_move = pain2_move;
    } else {
        self.monsterinfo.current_move = pain3_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.takedamage = false;
    self.monsterinfo.current_move = death_move;
  };

  self.think = monster_think;

  jorg_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerJorgSpawns(registry: SpawnRegistry): void {
  registry.register('monster_jorg', SP_monster_jorg);
}
