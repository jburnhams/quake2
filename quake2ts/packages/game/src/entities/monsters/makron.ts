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
  monster_fire_blaster,
  monster_fire_railgun,
  monster_fire_bfg,
} from './attack.js';
import { MuzzleFlash } from '../../combat/muzzleflash.js';
import { EntitySystem } from '../system.js';
import { Vec3, copyVec3, angleVectors, subtractVec3, normalizeVec3, scaleVec3, addVec3, vectorToAngles } from '@quake2ts/shared';
import { projectFlashSource } from './common.js';
import { createRandomGenerator } from '@quake2ts/shared';

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
let attack3_move: MonsterMove; // BFG
let attack4_move: MonsterMove; // Hyperblaster
let attack5_move: MonsterMove; // Railgun
let pain4_move: MonsterMove;
let pain5_move: MonsterMove;
let pain6_move: MonsterMove;
let death2_move: MonsterMove;
let sight_move: MonsterMove;

function makron_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function makron_run(self: Entity): void {
  if (self.monsterinfo.aiflags & 16 /* AI_STAND_GROUND */) {
    self.monsterinfo.current_move = stand_move;
  } else {
    self.monsterinfo.current_move = run_move;
  }
}

function makron_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function makron_sight(self: Entity): void {
  self.monsterinfo.current_move = sight_move;
}

function makron_attack(self: Entity): void {
  const r = random.frandom();
  if (r <= 0.3) {
    self.monsterinfo.current_move = attack3_move;
  } else if (r <= 0.6) {
    self.monsterinfo.current_move = attack4_move;
  } else {
    self.monsterinfo.current_move = attack5_move;
  }
}

function makronBFG(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, MuzzleFlash.MakronBfg, forward, right);

  const vec = subtractVec3(self.enemy.origin, start);
  const dir = normalizeVec3({ x: vec.x, y: vec.y, z: vec.z + self.enemy.viewheight });

  // Sound
  monster_fire_bfg(self, start, dir, 50, 300, 100, 300, MuzzleFlash.MakronBfg, context);
}

function MakronSaveloc(self: Entity): void {
  if (!self.enemy) return;
  self.pos1 = copyVec3(self.enemy.origin);
  self.pos1.z += self.enemy.viewheight;
}

function MakronRailgun(self: Entity, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, MuzzleFlash.MakronRailgun1, forward, right);

  const dir = normalizeVec3(subtractVec3(self.pos1!, start));

  monster_fire_railgun(self, start, dir, 50, 100, MuzzleFlash.MakronRailgun1, context);
}

function MakronHyperblaster(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  // Flash calculation based on frame
  // Approximate logic:
  const flash_number = MuzzleFlash.MakronBlaster1;

  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, flash_number, forward, right);

  const vec = subtractVec3(self.enemy.origin, start);
  vec.z += self.enemy.viewheight;
  const angles = vectorToAngles(vec);
  const dir = { x: 0, y: angles.y, z: 0 };

  // Adjust yaw based on frame if needed (spread)

  const { forward: fwd } = angleVectors(dir);
  monster_fire_blaster(self, start, fwd, 15, 1000, flash_number, 1 /* EF_BLASTER */, context);
}

function makron_dead(self: Entity, context: EntitySystem): void {
  // Explode logic
  self.movetype = MoveType.Toss;
}

function makron_spawn_torso(self: Entity, context: EntitySystem): void {
  // throwGib(self, "models/monsters/boss3/rider/tris.md2", ...)
  // For now just throw standard gibs
}

// Frames
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
stand_move = {
  firstframe: 0,
  lastframe: 59,
  frames: stand_frames,
  endfunc: makron_stand
};

const run_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_run,
  dist: 10
}));
run_move = {
  firstframe: 60,
  lastframe: 69,
  frames: run_frames,
  endfunc: makron_run
};

const walk_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_walk,
  dist: 10
}));
walk_move = {
  firstframe: 60,
  lastframe: 69,
  frames: walk_frames,
  endfunc: makron_walk
};

// Sight: 13 frames
const sight_frames: MonsterFrame[] = Array.from({ length: 13 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
sight_move = {
  firstframe: 70, // Placeholder
  lastframe: 82,
  frames: sight_frames,
  endfunc: makron_run
};

// Attack 3 (BFG): 8 frames
const attack3_frames: MonsterFrame[] = Array.from({ length: 8 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: i === 3 ? makronBFG : undefined
}));
attack3_move = {
  firstframe: 83,
  lastframe: 90,
  frames: attack3_frames,
  endfunc: makron_run
};

// Attack 4 (Hyperblaster): 26 frames
const attack4_frames: MonsterFrame[] = Array.from({ length: 26 }, (_, i) => ({
  ai: monster_ai_move,
  dist: 0,
  think: (i >= 4 && i <= 21) ? MakronHyperblaster : undefined
}));
attack4_move = {
  firstframe: 91,
  lastframe: 116,
  frames: attack4_frames,
  endfunc: makron_run
};

// Attack 5 (Railgun): 16 frames
const attack5_frames: MonsterFrame[] = Array.from({ length: 16 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: i === 7 ? MakronSaveloc : (i === 8 ? MakronRailgun : undefined)
}));
attack5_move = {
  firstframe: 117,
  lastframe: 132,
  frames: attack5_frames,
  endfunc: makron_run
};

const pain4_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain4_move = {
  firstframe: 133,
  lastframe: 136,
  frames: pain4_frames,
  endfunc: makron_run
};

const pain5_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain5_move = {
  firstframe: 137,
  lastframe: 140,
  frames: pain5_frames,
  endfunc: makron_run
};

const pain6_frames: MonsterFrame[] = Array.from({ length: 27 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain6_move = {
  firstframe: 141,
  lastframe: 167,
  frames: pain6_frames,
  endfunc: makron_run
};

const death2_frames: MonsterFrame[] = Array.from({ length: 95 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
death2_move = {
  firstframe: 168,
  lastframe: 262,
  frames: death2_frames,
  endfunc: makron_dead
};

export function SP_monster_makron(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_makron';
  self.model = 'models/monsters/boss3/rider/tris.md2';
  self.mins = { x: -30, y: -30, z: 0 };
  self.maxs = { x: 30, y: 30, z: 90 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 500;
  self.takedamage = true;
  self.viewheight = 100; // Guess

  self.monsterinfo.stand = makron_stand;
  self.monsterinfo.walk = makron_walk;
  self.monsterinfo.run = makron_run;
  self.monsterinfo.attack = makron_attack;
  self.monsterinfo.sight = makron_sight;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
        self.skin = 1;
    }

    if (damage <= 25 && random.frandom() < 0.2) return;

    if (damage <= 40) {
        self.monsterinfo.current_move = pain4_move;
    } else if (damage <= 110) {
        self.monsterinfo.current_move = pain5_move;
    } else {
        self.monsterinfo.current_move = pain6_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.takedamage = false;

    if (self.health < -2000) { // gib
       throwGibs(context.entities, self.origin, damage);
       context.entities.free(self);
       return;
    }

    self.monsterinfo.current_move = death2_move;
    makron_spawn_torso(self, context.entities);
  };

  self.think = monster_think;

  makron_sight(self); // Start in sight animation
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerMakronSpawns(registry: SpawnRegistry): void {
  registry.register('monster_makron', SP_monster_makron);
}
