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
<<<<<<< HEAD
<<<<<<< HEAD
  EntityFlags
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { monster_fire_rocket, monster_fire_blaster } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

=======
=======
>>>>>>> origin/main
  EntityFlags,
  PainCallback,
  MonsterAction,
} from '../entity.js';
import type { EntitySystem } from '../system.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { monster_fire_bullet_v2, monster_fire_bfg } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3, angleVectors, scaleVec3, addVec3, ZERO_VEC3, lengthVec3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { visible, rangeTo } from '../../ai/perception.js';

const MONSTER_TICK = 0.1;

// Offsets
const JORG_MACHINEGUN_R1_OFFSET: Vec3 = { x: 40, y: -20, z: 20 }; // Approx
const JORG_MACHINEGUN_L1_OFFSET: Vec3 = { x: 40, y: 20, z: 20 };
const JORG_BFG_OFFSET: Vec3 = { x: 30, y: 0, z: 40 };

<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
// Wrappers
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
<<<<<<< HEAD
<<<<<<< HEAD
let attack_move: MonsterMove;
let pain_move: MonsterMove;
=======
=======
>>>>>>> origin/main
let attack1_move: MonsterMove;
let attack1_end_move: MonsterMove;
let attack2_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
let death_move: MonsterMove;

function jorg_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function jorg_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function jorg_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function jorg_attack(self: Entity): void {
<<<<<<< HEAD
<<<<<<< HEAD
  self.monsterinfo.current_move = attack_move;
}

function jorg_fire(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Jorg (Makron Suit) has dual chainguns and BFG
    // Using blaster/rocket as placeholder for now
    monster_fire_blaster(self, start, forward, 20, 1000, 0, 0, context, DamageMod.BLASTER);
}

function jorg_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
=======
=======
>>>>>>> origin/main
    if (!self.enemy) return;

    // Attack 1: Dual Machineguns
    // Attack 2: BFG

    if (Math.random() <= 0.75) {
        // Attack 1
        // Play sound
        self.monsterinfo.current_move = attack1_move; // Using start_attack1 logic from C
    } else {
        // Attack 2
        // Play sound
        self.monsterinfo.current_move = attack2_move;
    }
}

function jorg_reattack1(self: Entity, context: EntitySystem): void {
    const traceFn = (start: Vec3, end: Vec3, ignore: Entity, mask: number) => {
        const tr = context.trace(start, null, null, end, ignore, mask);
        return { fraction: tr.fraction, entity: tr.ent };
    };

    if (self.enemy && visible(self, self.enemy, traceFn)) {
        if (Math.random() < 0.9) {
            self.monsterinfo.current_move = attack1_move; // Re-loop attack1
        } else {
            self.monsterinfo.current_move = attack1_end_move;
        }
    } else {
        self.monsterinfo.current_move = attack1_end_move;
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

function jorg_fire_bullet(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Fire left
    const startL = getProjectedOffset(self, JORG_MACHINEGUN_L1_OFFSET);
    const dirL = normalizeVec3(subtractVec3(self.enemy.origin, startL));
    monster_fire_bullet_v2(self, startL, dirL, 6, 4, 0.05, 0.05, 0, context, DamageMod.MACHINEGUN);

    // Fire right
    const startR = getProjectedOffset(self, JORG_MACHINEGUN_R1_OFFSET);
    const dirR = normalizeVec3(subtractVec3(self.enemy.origin, startR));
    monster_fire_bullet_v2(self, startR, dirR, 6, 4, 0.05, 0.05, 0, context, DamageMod.MACHINEGUN);
}

function jorg_fire_bfg(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = getProjectedOffset(self, JORG_BFG_OFFSET);
    const target = { ...self.enemy.origin };
    target.z += (self.enemy.viewheight || 0);
    const dir = normalizeVec3(subtractVec3(target, start));

    (monster_fire_bfg as any)(self, start, dir, 50, 300, 100, 200, 0, context);
}

function jorg_pain(self: Entity, other: Entity | null, kick: number, damage: number): void {
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;

    if (damage <= 40 && Math.random() <= 0.6) return;

    // Lessen chance if attacking
    // Simplified: just check if in attack move
    if (self.monsterinfo.current_move === attack1_move || self.monsterinfo.current_move === attack2_move) {
        if (Math.random() <= 0.005) return;
    }

    self.pain_finished_time = self.timestamp + 3.0;

    if (damage <= 50) {
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= 100) {
        self.monsterinfo.current_move = pain2_move;
    } else {
        if (Math.random() <= 0.3) {
            self.monsterinfo.current_move = pain3_move;
        }
    }
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
}

function jorg_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
}

function jorg_dead(self: Entity): void {
<<<<<<< HEAD
<<<<<<< HEAD
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
  // TODO: Spawn Makron (monster_makron) upon death!
}

// Frames
// Stand
const stand_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 45,
  frames: stand_frames,
  endfunc: jorg_stand,
};

// Walk
const walk_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_walk,
  dist: 10,
}));

walk_move = {
  firstframe: 0,
  lastframe: 45,
  frames: walk_frames,
  endfunc: jorg_walk,
};

// Run
const run_frames: MonsterFrame[] = Array.from({ length: 46 }, () => ({
  ai: monster_ai_run,
  dist: 20,
}));

run_move = {
  firstframe: 0,
  lastframe: 45,
  frames: run_frames,
  endfunc: jorg_run,
};

// Attack
const attack_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 15) ? jorg_fire : null
}));

attack_move = {
    firstframe: 46,
    lastframe: 75,
    frames: attack_frames,
    endfunc: jorg_run
};

// Pain
const pain_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

pain_move = {
    firstframe: 76,
    lastframe: 85,
    frames: pain_frames,
    endfunc: jorg_run
}

// Death
const death_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));

death_move = {
    firstframe: 86,
    lastframe: 105,
    frames: death_frames,
    endfunc: jorg_dead
}
=======
=======
>>>>>>> origin/main
    // Spawn Makron?
    // In original, MakronToss spawns Makron.
    // For now, just mark dead.
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
}

function makron_toss(self: Entity, context: any): void {
    const makron = context.spawn();
    makron.classname = 'monster_makron';
    makron.origin = { ...self.origin };
    makron.angles = { ...self.angles };
}

// Use local type to break inference loop or type check confusion
type LocalMonsterAction = (self: Entity, context: EntitySystem) => void;

// Frames
// Stand: 51 frames
const stand_frames: MonsterFrame[] = Array.from({ length: 51 }, () => ({ ai: monster_ai_stand, dist: 0 }));
stand_move = { firstframe: 0, lastframe: 50, frames: stand_frames, endfunc: jorg_stand };

// Walk: 14 frames
const walk_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({ ai: monster_ai_walk, dist: 10 }));
walk_move = { firstframe: 51, lastframe: 64, frames: walk_frames, endfunc: jorg_walk };

// Run: 14 frames (same as walk basically)
const run_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({ ai: monster_ai_run, dist: 10 }));
run_move = { firstframe: 51, lastframe: 64, frames: run_frames, endfunc: jorg_run };

// Attack 1 Start: 8 frames
const attack1_start_frames: MonsterFrame[] = Array.from({ length: 8 }, () => ({ ai: monster_ai_charge, dist: 0 }));
const attack1_start_move: MonsterMove = { firstframe: 65, lastframe: 72, frames: attack1_start_frames, endfunc: null }; // Chains to attack1

// Attack 1 Loop: 6 frames
const attack1_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({ ai: monster_ai_charge, dist: 0, think: jorg_fire_bullet }));
attack1_move = { firstframe: 73, lastframe: 78, frames: attack1_frames, endfunc: jorg_reattack1 };
// Link start to loop manually in logic or via 'endfunc' trick if needed.
// C code: jorg_attack sets currentmove to start_attack1. start_attack1 endfunc calls jorg_attack1.
attack1_start_move.endfunc = (self) => { self.monsterinfo.current_move = attack1_move; };


// Attack 1 End: 4 frames
const attack1_end_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
attack1_end_move = { firstframe: 79, lastframe: 82, frames: attack1_end_frames, endfunc: jorg_run };

// Attack 2 (BFG): 13 frames
const attack2_frames: MonsterFrame[] = Array.from({ length: 13 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 6) ? jorg_fire_bfg : null
}));
attack2_move = { firstframe: 83, lastframe: 95, frames: attack2_frames, endfunc: jorg_run };

// Pain 1: 3 frames
const pain1_frames: MonsterFrame[] = Array.from({ length: 3 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain1_move = { firstframe: 96, lastframe: 98, frames: pain1_frames, endfunc: jorg_run };

// Pain 2: 3 frames
const pain2_frames: MonsterFrame[] = Array.from({ length: 3 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain2_move = { firstframe: 99, lastframe: 101, frames: pain2_frames, endfunc: jorg_run };

// Pain 3: 25 frames
const pain3_frames: MonsterFrame[] = Array.from({ length: 25 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain3_move = { firstframe: 102, lastframe: 126, frames: pain3_frames, endfunc: jorg_run };

// Death: 50 frames
const death_frames: MonsterFrame[] = Array.from({ length: 50 }, (_, i) => ({
    ai: monster_ai_move,
    dist: 0,
    think: ((i === 49) ? ((self: Entity, ctx: EntitySystem) => { /* BossExplode? */ }) : ((i === 48) ? makron_toss : null)) as LocalMonsterAction | null
}));
death_move = { firstframe: 127, lastframe: 176, frames: death_frames, endfunc: jorg_dead };
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main


export function SP_monster_jorg(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_jorg';
<<<<<<< HEAD
<<<<<<< HEAD
  self.model = 'models/monsters/boss3/jorg.md2';
  self.mins = { x: -80, y: -80, z: -24 };
=======
=======
>>>>>>> origin/main
  self.model = 'models/monsters/boss3/rider/tris.md2'; // Jorg is the rider
  // self.model2 = 'models/monsters/boss3/jorg/tris.md2'; // The mech

  // context.precacheModel('models/monsters/boss3/jorg/tris.md2');
  // ... remove precacheModel ...

  self.mins = { x: -80, y: -80, z: 0 };
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
  self.maxs = { x: 80, y: 80, z: 140 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 3000;
  self.max_health = 3000;
  self.mass = 1000;
  self.takedamage = true;
<<<<<<< HEAD
<<<<<<< HEAD
  self.viewheight = 120;

  self.pain = (self, other, kick, damage) => {
    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }
  };

=======
  self.viewheight = 90; // Guess

  self.pain = jorg_pain;
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
  self.viewheight = 90; // Guess

  self.pain = jorg_pain;
>>>>>>> origin/main
  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

<<<<<<< HEAD
<<<<<<< HEAD
    // Jorg doesn't gib, he crashes and releases Makron
    // if (self.health < -80) { ... }
=======
=======
>>>>>>> origin/main
    // Check for gibs? C code allows gibbing (-2000 health)
    if (self.health < -2000) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main

    jorg_die(self);
  };

  self.monsterinfo.stand = jorg_stand;
  self.monsterinfo.walk = jorg_walk;
  self.monsterinfo.run = jorg_run;
  self.monsterinfo.attack = jorg_attack;

  self.think = monster_think;

  jorg_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerJorgSpawns(registry: SpawnRegistry): void {
  registry.register('monster_jorg', SP_monster_jorg);
}
