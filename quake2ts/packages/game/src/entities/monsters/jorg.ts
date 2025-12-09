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
  PainCallback,
  MonsterAction,
} from '../entity.js';
import type { EntitySystem } from '../system.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { monster_fire_bullet_v2, monster_fire_bfg } from './attack.js';
import { SP_monster_makron } from './makron.js';
import { normalizeVec3, subtractVec3, Vec3, angleVectors, scaleVec3, addVec3, ZERO_VEC3, lengthVec3, vectorToYaw } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { visible, rangeTo } from '../../ai/perception.js';
import { PredictAim } from '../../ai/rogue.js';

const MONSTER_TICK = 0.1;

// Constants - Source: game/m_boss31.c
const JORG_HEALTH = 3000;
const JORG_MASS = 1000;
const JORG_GIB_HEALTH = -2000;
const JORG_VIEWHEIGHT = 25; // Source: full/game/g_monster.c:walkmonster_start_go
const JORG_ATTACK_CHANCE_1 = 0.75; // game/m_boss31.c:380
const JORG_REFIRE_CHANCE = 0.9;
const JORG_PAIN_DAMAGE_THRESHOLD_1 = 50;
const JORG_PAIN_DAMAGE_THRESHOLD_2 = 100;
const JORG_PAIN_CHANCE_LOW = 0.6;
const JORG_PAIN_CHANCE_ATTACK = 0.005;
const JORG_PAIN_CHANCE_HIGH = 0.3;

const JORG_MACHINEGUN_DAMAGE = 6;
const JORG_MACHINEGUN_KICK = 4;
const JORG_MACHINEGUN_HSPREAD = 0.05;
const JORG_MACHINEGUN_VSPREAD = 0.05;

const JORG_BFG_DAMAGE = 50;
const JORG_BFG_SPEED = 300;
const JORG_BFG_KICK = 100;
const JORG_BFG_RADIUS = 200;

const MAKRON_TOSS_SPEED = 400;
const MAKRON_TOSS_Z = 200;

// Offsets
const JORG_MACHINEGUN_R1_OFFSET: Vec3 = { x: 40, y: -20, z: 20 }; // Approx
const JORG_MACHINEGUN_L1_OFFSET: Vec3 = { x: 40, y: 20, z: 20 };
const JORG_BFG_OFFSET: Vec3 = { x: 30, y: 0, z: 40 };

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
let attack1_move: MonsterMove;
let attack1_end_move: MonsterMove;
let attack2_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
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

function jorg_attack(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    // Attack 1: Dual Machineguns
    // Attack 2: BFG

    if (context.rng.frandom() <= JORG_ATTACK_CHANCE_1) {
        // Attack 1
        context.sound(self, 0, 'boss3/bs3atck1.wav', 1, 1, 0);
        self.monsterinfo.current_move = attack1_move; // Using start_attack1 logic from C
    } else {
        // Attack 2
        context.sound(self, 0, 'boss3/bs3atck2.wav', 1, 1, 0);
        self.monsterinfo.current_move = attack2_move;
    }
}

function jorg_reattack1(self: Entity, context: EntitySystem): void {
    const traceFn = (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, ignore: Entity | null, mask: number) => {
        const tr = context.trace(start, mins, maxs, end, ignore, mask);
        return { fraction: tr.fraction, ent: tr.ent };
    };

    if (self.enemy && visible(self, self.enemy, traceFn)) {
        if (context.rng.frandom() < JORG_REFIRE_CHANCE) {
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
    const { aimdir: dirL } = PredictAim(context, self, self.enemy, startL, 0, false, 0.2);
    monster_fire_bullet_v2(self, startL, dirL, JORG_MACHINEGUN_DAMAGE, JORG_MACHINEGUN_KICK, JORG_MACHINEGUN_HSPREAD, JORG_MACHINEGUN_VSPREAD, 0, context, DamageMod.MACHINEGUN);

    // Fire right
    const startR = getProjectedOffset(self, JORG_MACHINEGUN_R1_OFFSET);
    const { aimdir: dirR } = PredictAim(context, self, self.enemy, startR, 0, false, -0.2);
    monster_fire_bullet_v2(self, startR, dirR, JORG_MACHINEGUN_DAMAGE, JORG_MACHINEGUN_KICK, JORG_MACHINEGUN_HSPREAD, JORG_MACHINEGUN_VSPREAD, 0, context, DamageMod.MACHINEGUN);
}

function jorg_fire_bfg(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = getProjectedOffset(self, JORG_BFG_OFFSET);
    const target = { ...self.enemy.origin };
    target.z += (self.enemy.viewheight || 0);
    const dir = normalizeVec3(subtractVec3(target, start));

    (monster_fire_bfg as any)(self, start, dir, JORG_BFG_DAMAGE, JORG_BFG_SPEED, JORG_BFG_KICK, JORG_BFG_RADIUS, 0, context);
}

function jorg_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.health < (self.max_health / 2)) {
      self.skin = 1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;

    if (damage <= 40 && context.rng.frandom() <= JORG_PAIN_CHANCE_LOW) return;

    // Lessen chance if attacking
    // Simplified: just check if in attack move
    if (self.monsterinfo.current_move === attack1_move || self.monsterinfo.current_move === attack2_move) {
        if (context.rng.frandom() > JORG_PAIN_CHANCE_ATTACK) return;
    }

    self.pain_finished_time = self.timestamp + 3.0;

    if (damage <= JORG_PAIN_DAMAGE_THRESHOLD_1) {
        context.engine.sound?.(self, 0, 'boss3/bs3pain1.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= JORG_PAIN_DAMAGE_THRESHOLD_2) {
        context.engine.sound?.(self, 0, 'boss3/bs3pain2.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain2_move;
    } else {
        if (context.rng.frandom() <= JORG_PAIN_CHANCE_HIGH) {
            context.engine.sound?.(self, 0, 'boss3/bs3pain3.wav', 1, 1, 0);
            self.monsterinfo.current_move = pain3_move;
        }
    }
}

function jorg_die(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'boss3/bs3deth1.wav', 1, 1, 0);
  self.monsterinfo.current_move = death_move;
}

function jorg_dead(self: Entity): void {
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
    makron.target = self.target;
    makron.enemy = self.enemy;

    // Use SP_monster_makron to initialize
    // We need to pass context which is usually SpawnContext.
    // Here 'context' is likely EntitySystem (passed from think).
    // SP_monster_makron expects { entities: EntitySystem, ... } as SpawnContext.
    // We can construct a minimal mock or cast if SP function structure allows.
    // SP functions typically only use .entities from context.
    // Ensure health_multiplier defaults to 1 if not present on context (which it isn't on EntitySystem)
    const spawnContext = { entities: context, health_multiplier: 1 } as any as SpawnContext;
    SP_monster_makron(makron, spawnContext);

    // Jump at player
    if (makron.enemy && makron.enemy.health > 0) {
        const vec = subtractVec3(makron.enemy.origin, makron.origin);
        makron.angles = { ...makron.angles, y: vectorToYaw(vec) };
        const dir = normalizeVec3(vec);
        // We cannot assign directly to readonly properties of Vec3
        const vel = scaleVec3(dir, MAKRON_TOSS_SPEED);
        makron.velocity = { x: vel.x, y: vel.y, z: MAKRON_TOSS_Z };
        // For physics to update, we need to ensure velocity is used
        // Typically gravity/physics runs every frame.
        // Also ensure groundentity is cleared
        makron.groundentity = null;

        if (makron.monsterinfo.sight) {
            makron.monsterinfo.sight(makron, makron.enemy);
        }
        // Force frame to active01 if needed, or rely on sight logic
        // self->s.frame = self->monsterinfo.nextframe = FRAME_active01;
        // We'll let standard sight logic handle animation transition if possible,
        // or force it if needed. SP_monster_makron sets sight_move as current.
    }
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


export function SP_monster_jorg(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_jorg';
  // Jorg is the mech, Rider is the attachment. Main entity uses Mech model?
  // C code: self->s.modelindex = gi.modelindex ("models/monsters/boss3/jorg/tris.md2");
  self.model = 'models/monsters/boss3/jorg/tris.md2';
  // self.model2 = 'models/monsters/boss3/rider/tris.md2'; // The rider

  // context.precacheModel('models/monsters/boss3/jorg/tris.md2');
  // ... remove precacheModel ...

  self.mins = { x: -80, y: -80, z: 0 };
  self.maxs = { x: 80, y: 80, z: 140 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  if (context.health_multiplier) {
    self.health = JORG_HEALTH * context.health_multiplier;
  } else {
    self.health = JORG_HEALTH;
  }
  self.max_health = self.health;
  self.mass = JORG_MASS;
  self.takedamage = true;
  self.viewheight = JORG_VIEWHEIGHT;

  self.pain = (ent, other, kick, dmg) => jorg_pain(ent, other, kick, dmg, context.entities);
  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    // Check for gibs? C code allows gibbing (-2000 health)
    if (self.health < JORG_GIB_HEALTH) {
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    jorg_die(self, context.entities);
  };

  self.monsterinfo.stand = jorg_stand;
  self.monsterinfo.walk = jorg_walk;
  self.monsterinfo.run = jorg_run;
  self.monsterinfo.attack = (ent) => jorg_attack(ent, context.entities);
  self.monsterinfo.sight = (self, other) => {
      context.entities.sound?.(self, 0, 'boss3/sight1.wav', 1, 1, 0);
  };

  self.think = monster_think;

  jorg_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerJorgSpawns(registry: SpawnRegistry): void {
  registry.register('monster_jorg', SP_monster_jorg);
}
