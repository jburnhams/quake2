import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import {
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
  EntityFlags,
  DeadFlag,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import {
  monster_fire_bullet,
  monster_fire_grenade,
  monster_fire_rocket,
} from './attack.js';
import { rangeTo, visible } from '../../ai/perception.js';
import { MuzzleFlash } from '../../combat/muzzleflash.js';
import { EntitySystem } from '../system.js';
import { Vec3, copyVec3, subtractVec3, angleVectors } from '@quake2ts/shared';
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
let attack1_move: MonsterMove; // Machinegun
let end_attack1_move: MonsterMove;
let attack2_move: MonsterMove; // Rocket
let attack4_move: MonsterMove; // Grenade
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;

function supertank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function supertank_run(self: Entity): void {
  if (self.monsterinfo.aiflags & 16 /* AI_STAND_GROUND */) {
    self.monsterinfo.current_move = stand_move;
  } else {
    self.monsterinfo.current_move = run_move;
  }
}

function supertank_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function supertank_dead(self: Entity): void {
  if (self.spawnflags & 4 /* SPAWNFLAG_MONSTER_DEAD */) {
    self.deadflag = DeadFlag.Dead;
    self.takedamage = true;
    return;
  }
}

function supertankMachineGun(self: Entity, context: EntitySystem): void {
  if (!self.enemy) return;

  const flash_number = MuzzleFlash.SupertankMachinegun1;

  const dir = { x: 0, y: self.angles.y, z: 0 };

  const { forward, right } = angleVectors(dir);

  const start = projectFlashSource(self, flash_number, forward, right);

  monster_fire_bullet(self, start, forward, 6, 4, 0.1, 0.1, flash_number, context);
}

function supertankRocket1(self: Entity, context: EntitySystem): void {
  fire_rocket(self, MuzzleFlash.SupertankRocket1, context);
}
function supertankRocket2(self: Entity, context: EntitySystem): void {
  fire_rocket(self, MuzzleFlash.SupertankRocket2, context);
}
function supertankRocket3(self: Entity, context: EntitySystem): void {
  fire_rocket(self, MuzzleFlash.SupertankRocket3, context);
}

function fire_rocket(self: Entity, flash: MuzzleFlash, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, flash, forward, right);

  monster_fire_rocket(self, start, forward, 50, 750, flash, context);
}

function supertankGrenade1(self: Entity, context: EntitySystem): void {
  fire_grenade(self, MuzzleFlash.SupertankGrenade1, context);
}
function supertankGrenade2(self: Entity, context: EntitySystem): void {
  fire_grenade(self, MuzzleFlash.SupertankGrenade2, context);
}

function fire_grenade(self: Entity, flash: MuzzleFlash, context: EntitySystem): void {
  const { forward, right } = angleVectors(self.angles);
  const start = projectFlashSource(self, flash, forward, right);

  monster_fire_grenade(self, start, forward, 50, 600, flash, context);
}


function supertank_attack(self: Entity, context: EntitySystem): void {
  const vec = subtractVec3(self.enemy!.origin, self.origin);
  const range = rangeTo(self, self.enemy!);

  const r = random.frandom();
  if (range <= 540 && r < 0.4) {
    self.monsterinfo.current_move = attack1_move; // Machinegun
  } else if (r < 0.7) {
    self.monsterinfo.current_move = attack2_move; // Rocket
  } else {
    self.monsterinfo.current_move = attack4_move; // Grenade
  }
}

function supertank_reattack1(self: Entity): void {
  if (self.enemy && visible(self, self.enemy)) {
    if (random.frandom() < 0.3) {
       self.monsterinfo.current_move = attack1_move;
       return;
    }
  }
  self.monsterinfo.current_move = end_attack1_move;
}

// Stand: 60 frames
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({
  ai: monster_ai_stand,
  dist: 0
}));
stand_move = {
  firstframe: 0,
  lastframe: 59,
  frames: stand_frames,
  endfunc: supertank_stand
};

// Run: 18 frames
const run_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
  ai: monster_ai_run,
  dist: 12
}));
run_move = {
  firstframe: 60,
  lastframe: 77,
  frames: run_frames,
  endfunc: supertank_run
};

// Walk: 18 frames
const walk_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
  ai: monster_ai_walk,
  dist: 4
}));
walk_move = {
  firstframe: 60,
  lastframe: 77,
  frames: walk_frames,
  endfunc: supertank_walk
};

// Attack 1 (Machinegun): 6 firing frames
const attack1_frames: MonsterFrame[] = Array.from({ length: 6 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: supertankMachineGun
}));
attack1_move = {
  firstframe: 78,
  lastframe: 83,
  frames: attack1_frames,
  endfunc: supertank_reattack1
};

const end_attack1_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
end_attack1_move = {
  firstframe: 84,
  lastframe: 97,
  frames: end_attack1_frames,
  endfunc: supertank_run
};

// Attack 2 (Rocket): 27 frames
const attack2_frames: MonsterFrame[] = Array.from({ length: 27 }, (_, i) => {
  let thinkFunc: ((self: Entity, ctx: EntitySystem) => void) | undefined = undefined;
  if (i === 7) thinkFunc = supertankRocket1;
  if (i === 10) thinkFunc = supertankRocket2;
  if (i === 13) thinkFunc = supertankRocket3;
  return {
    ai: monster_ai_charge,
    dist: 0,
    think: thinkFunc
  };
});
attack2_move = {
  firstframe: 98,
  lastframe: 124,
  frames: attack2_frames,
  endfunc: supertank_run
};

// Attack 4 (Grenade): 6 frames
const attack4_frames: MonsterFrame[] = Array.from({ length: 6 }, (_, i) => {
  let thinkFunc: ((self: Entity, ctx: EntitySystem) => void) | undefined = undefined;
  if (i === 0) thinkFunc = supertankGrenade1;
  if (i === 3) thinkFunc = supertankGrenade2;
  return {
    ai: monster_ai_move,
    dist: 0,
    think: thinkFunc
  };
});
attack4_move = {
  firstframe: 125,
  lastframe: 130,
  frames: attack4_frames,
  endfunc: supertank_run
};

// Pain 1: 4 frames
const pain1_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain1_move = {
  firstframe: 131,
  lastframe: 134,
  frames: pain1_frames,
  endfunc: supertank_run
};

// Pain 2: 4 frames
const pain2_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain2_move = {
  firstframe: 135,
  lastframe: 138,
  frames: pain2_frames,
  endfunc: supertank_run
};

// Pain 3: 4 frames
const pain3_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({
  ai: monster_ai_move,
  dist: 0
}));
pain3_move = {
  firstframe: 139,
  lastframe: 142,
  frames: pain3_frames,
  endfunc: supertank_run
};

// Death: 24 frames
const death_frames: MonsterFrame[] = Array.from({ length: 24 }, (_, i) => {
    return {
        ai: monster_ai_move,
        dist: 0
    };
});
death_move = {
    firstframe: 143,
    lastframe: 166,
    frames: death_frames,
    endfunc: supertank_dead
};


export function SP_monster_supertank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_supertank';
  self.model = 'models/monsters/boss1/tris.md2';

  self.mins = { x: -64, y: -64, z: 0 };
  self.maxs = { x: 64, y: 64, z: 112 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 1500;
  self.max_health = 1500;
  self.mass = 800;
  self.takedamage = true;
  self.viewheight = 100;

  self.monsterinfo.stand = supertank_stand;
  self.monsterinfo.walk = supertank_walk;
  self.monsterinfo.run = supertank_run;
  self.monsterinfo.attack = supertank_attack;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    if (random.frandom() < 0.2) return;

    if (damage <= 10) {
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= 25) {
        self.monsterinfo.current_move = pain2_move;
    } else {
        self.monsterinfo.current_move = pain3_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
     self.skin = 1;
     self.deadflag = DeadFlag.Dead;
     self.solid = Solid.Not;
     self.takedamage = false;

     if (self.health < -500) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
     }

     self.monsterinfo.current_move = death_move;
  };

  self.think = monster_think;

  supertank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', SP_monster_supertank);
}
