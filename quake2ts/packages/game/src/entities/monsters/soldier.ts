import { angleVectors, normalizeVec3, subtractVec3, Vec3, addVec3, scaleVec3, vectorToAngles } from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
} from '../../ai/index.js';
import { M_ShouldReactToPain } from './common.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
} from '../entity.js';
import { SpawnContext } from '../spawn.js';
import { SpawnRegistry } from '../spawn.js';
import { monster_fire_bullet, monster_fire_blaster, monster_fire_shotgun, monster_fire_ionripper, monster_fire_blueblaster, monster_fire_dabeam } from './attack.js';
import { throwGibs } from '../gibs.js';
import type { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;

const SOLDIER_LIGHT = 1;
const SOLDIER_SSG = 2;
const SOLDIER_MACHINEGUN = 4;

// Wrappers for AI functions to match AIAction signature (self, dist)
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, dist, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  ai_run(self, dist, context);
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations for moves
let stand_move: MonsterMove;
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack_move: MonsterMove; // Default/Blaster/SSG
let attack_move_mg: MonsterMove; // Machinegun
let pain_move: MonsterMove;
let death_move: MonsterMove;

function soldier_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function soldier_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function soldier_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function soldier_attack(self: Entity): void {
  // Choose attack move based on spawnflags or skin/count
  if (self.spawnflags & SOLDIER_MACHINEGUN) {
    self.monsterinfo.current_move = attack_move_mg;
  } else if (self.style === 1 && self.count >= 4) {
    // Lasergun soldier uses machinegun frames (attack4)
    self.monsterinfo.current_move = attack_move_mg;
  } else {
    self.monsterinfo.current_move = attack_move;
  }
}

function soldier_pain(self: Entity): void {
  self.monsterinfo.current_move = pain_move;
}

function soldier_die(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'soldier/death1.wav', 1, 1, 0);
  self.monsterinfo.current_move = death_move;
}

function get_fire_start(self: Entity): Vec3 {
  return {
    x: self.origin.x,
    y: self.origin.y,
    z: self.origin.z + self.viewheight,
  };
}

function get_fire_dir(self: Entity, start: Vec3): Vec3 {
  if (!self.enemy) {
    const { forward } = angleVectors(self.angles);
    return forward;
  }

  const target = {
    x: self.enemy.origin.x,
    y: self.enemy.origin.y,
    z: self.enemy.origin.z + (self.enemy.viewheight || 0),
  };

  return normalizeVec3(subtractVec3(target, start));
}

function soldier_fire_blaster(self: Entity, context: any): void {
  if (!self.enemy) return;
  const start = get_fire_start(self);
  const forward = get_fire_dir(self, start);
  const damage = 5;
  const speed = 600;

  monster_fire_blaster(self, start, forward, damage, speed, 0, 0, context, DamageMod.BLASTER);
}

function soldier_fire_ssg(self: Entity, context: any): void {
  if (!self.enemy) return;
  const start = get_fire_start(self);
  const forward = get_fire_dir(self, start);
  const damage = 2;
  const kick = 4;
  const count = 20;
  const hspread = 0.15;
  const vspread = 0.15;

  context.engine.sound?.(self, 0, 'soldier/solatck2.wav', 1, 1, 0);

  monster_fire_shotgun(self, start, forward, damage, kick, hspread, vspread, count, 0, context, DamageMod.SSHOTGUN);
}

function soldier_fire_machinegun(self: Entity, context: any): void {
  if (!self.enemy) return;
  const start = get_fire_start(self);
  const forward = get_fire_dir(self, start);
  const damage = 4;
  const kick = 4;
  const hspread = 0.05;
  const vspread = 0.05;

  context.engine.sound?.(self, 0, 'soldier/solatck3.wav', 1, 1, 0);

  monster_fire_bullet(self, start, forward, damage, kick, hspread, vspread, 0, context, DamageMod.MACHINEGUN);
}

// Xatrix Variants Logic

function soldierh_laser_update(beam: Entity, context: any): void {
  const self = beam.owner;
  if (!self || !self.enemy) return;

  const { forward, right, up } = angleVectors(self.angles);
  let start = { ...self.origin };
  // monster_flash_offset[flash_index] equivalent needed?
  // C++ uses monster_flash_offset table. We approximate.
  // Standard offset for soldier gun?
  // x=16, y=0, z=viewheight?
  start = addVec3(start, scaleVec3(forward, 16));
  start.z += self.viewheight;

  // Aim logic with some jitter
  // PredictAim(self, self->enemy, start, 0, false, frandom(0.1f, 0.2f), &forward, NULL);
  // Simplified: aim at enemy
  const enemyCenter = { ...self.enemy.origin };
  enemyCenter.z += (self.enemy.viewheight || 0);
  const dir = normalizeVec3(subtractVec3(enemyCenter, start));

  beam.origin = start;
  beam.movedir = dir;
  context.linkentity(beam);
}

function soldier_fire_ripper(self: Entity, context: any): void {
    if (!self.enemy) return;
    const start = get_fire_start(self);
    const forward = get_fire_dir(self, start);

    // Damage dropped from 15 to 5 in C++
    const damage = 5;
    const speed = 600;

    monster_fire_ionripper(self, start, forward, damage, speed, 0, 0, context);
}

function soldier_fire_hypergun(self: Entity, context: any): void {
    if (!self.enemy) return;
    const start = get_fire_start(self);
    const forward = get_fire_dir(self, start);

    const damage = 1; // 1 damage? C++ says 1? Or 5?
    // C++: monster_fire_blueblaster(self, start, aim, 1, 600, ...);
    const speed = 600;

    context.engine.sound?.(self, 0, 'weapons/hyprbl1a.wav', 1, 1, 0);
    monster_fire_blueblaster(self, start, forward, damage, speed, 0, 0, context);
}

function soldier_fire_laser(self: Entity, context: any): void {
    if (!self.enemy) return;

    // C++: soldierh_laserbeam(self, flash_index);
    // Calls monster_fire_dabeam(self, 1, false, soldierh_laser_update);
    // Damage = 1? Actually monster_fire_dabeam(self, 1, ...).

    monster_fire_dabeam(self, 1, false, soldierh_laser_update, context);
}

function soldier_fire_xatrix(self: Entity, context: any): void {
    // Dispatch based on count (derived from skin)
    // count < 2: Ripper (Skin 6)
    // count < 4: Hypergun (Skin 8)
    // else: Laser (Skin 10)

    if (self.count < 2) {
        soldier_fire_ripper(self, context);
    } else if (self.count < 4) {
        soldier_fire_hypergun(self, context);
    } else {
        soldier_fire_laser(self, context);
    }
}

function soldier_fire(self: Entity, context: any): void {
  if (self.style === 1) {
      soldier_fire_xatrix(self, context);
      return;
  }

  // Dispatch based on flags
  if (self.spawnflags & SOLDIER_SSG) {
    soldier_fire_ssg(self, context);
  } else if (self.spawnflags & SOLDIER_MACHINEGUN) {
    soldier_fire_machinegun(self, context);
  } else {
    // Default is Blaster (Light or normal)
    soldier_fire_blaster(self, context);
  }
}

function soldier_idle(self: Entity, context: EntitySystem): void {
    if (context.rng.frandom() < 0.2) {
        context.sound?.(self, 0, 'soldier/idle.wav', 1, 2, 0);
    }
}

// Define moves
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 29,
  frames: stand_frames,
  endfunc: soldier_stand,
};

const walk_frames: MonsterFrame[] = Array.from({ length: 40 }, () => ({
  ai: monster_ai_walk,
  dist: 2,
}));

walk_move = {
  firstframe: 30,
  lastframe: 69,
  frames: walk_frames,
  endfunc: soldier_walk,
};

const run_frames: MonsterFrame[] = Array.from({ length: 20 }, () => ({
  ai: monster_ai_run,
  dist: 10,
}));

run_move = {
  firstframe: 70,
  lastframe: 89,
  frames: run_frames,
  endfunc: soldier_run,
};

// Attack 1 (Blaster/SSG/Ripper/Hypergun) - Fire once at frame 5
const attack_frames: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  think: i === 5 ? soldier_fire : null,
}));

attack_move = {
  firstframe: 90,
  lastframe: 99,
  frames: attack_frames,
  endfunc: soldier_run,
};

// Attack MG/Laser - Fire burst
const attack_frames_mg: MonsterFrame[] = Array.from({ length: 10 }, (_, i) => ({
  ai: monster_ai_charge,
  dist: 0,
  // Fire on frames 4, 5, 6, 7, 8
  // Note: Laser soldier fires continuously?
  // C++: soldierh_hyperripper8 called on frames 11, 13, 18?
  // Actually laser soldier (machinegun equivalent) fires on frames 4-8.
  think: (i >= 4 && i <= 8) ? soldier_fire : null,
}));

attack_move_mg = {
  firstframe: 90,
  lastframe: 99,
  frames: attack_frames_mg,
  endfunc: soldier_run,
};


const pain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

pain_move = {
  firstframe: 100,
  lastframe: 105,
  frames: pain_frames,
  endfunc: soldier_run,
};

const death_frames: MonsterFrame[] = Array.from({ length: 10 }, () => ({
  ai: monster_ai_move,
  dist: 0,
}));

// End of death animation - stay on last frame
function soldier_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1; // Stop thinking
}

death_move = {
  firstframe: 106,
  lastframe: 115,
  frames: death_frames,
  endfunc: soldier_dead,
};


export function SP_monster_soldier(self: Entity, context: SpawnContext): void {
  self.model = 'models/monsters/soldier/tris.md2';
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 20 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 100;
  self.takedamage = true;

  // Set skin and stats based on flags
  if (self.spawnflags & SOLDIER_SSG) {
    self.skin = 2;
    self.health = 30 * context.health_multiplier; // Slightly stronger?
    self.max_health = self.health;
  } else if (self.spawnflags & SOLDIER_MACHINEGUN) {
    self.skin = 4;
    self.health = 30 * context.health_multiplier;
    self.max_health = self.health;
  } else {
    // Light or Normal
    self.skin = 0;
    // self.health = 20;
  }

  // Override for Light soldier?
  if (self.spawnflags & SOLDIER_LIGHT) {
    self.health = 10 * context.health_multiplier;
    self.max_health = self.health;
  }

  self.pain = (self, other, kick, damage) => {
    if (!M_ShouldReactToPain(self, context.entities)) {
        return;
    }

    if (self.health < (self.max_health / 2)) {
      self.monsterinfo.current_move = pain_move;
    }

    // Set skin for pain/damage indication if needed (e.g. bloody)
    // C++ soldier_setskin sets bit 1 if health < max/2.
    // self.skin |= 1;

    if (context.entities.rng.frandom() < 0.5) {
        context.entities.sound?.(self, 0, 'soldier/pain1.wav', 1, 1, 0);
    } else {
        context.entities.sound?.(self, 0, 'soldier/pain2.wav', 1, 1, 0);
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -40) {
        context.entities.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    soldier_die(self, context.entities);
  };

  self.monsterinfo.stand = soldier_stand;
  self.monsterinfo.walk = soldier_walk;
  self.monsterinfo.run = soldier_run;
  self.monsterinfo.attack = soldier_attack;
  self.monsterinfo.sight = (self, other) => {
      if (context.entities.rng.frandom() < 0.5) {
          context.entities.sound?.(self, 0, 'soldier/sight1.wav', 1, 1, 0);
      } else {
          context.entities.sound?.(self, 0, 'soldier/sight2.wav', 1, 1, 0);
      }
  };
  self.monsterinfo.idle = (self) => soldier_idle(self, context.entities);

  self.think = monster_think;

  soldier_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function SP_monster_soldier_light(self: Entity, context: SpawnContext): void {
  self.spawnflags |= SOLDIER_LIGHT;
  SP_monster_soldier(self, context);
}

export function SP_monster_soldier_ssg(self: Entity, context: SpawnContext): void {
  self.spawnflags |= SOLDIER_SSG;
  SP_monster_soldier(self, context);
}

// Xatrix Spawns

function SP_monster_soldier_x(self: Entity, context: SpawnContext, skin: number, health: number): void {
    SP_monster_soldier(self, context);
    self.style = 1; // Mark as Xatrix variant
    self.skin = skin;
    self.count = skin - 6; // Set count for attack dispatch logic
    self.health = health * context.health_multiplier;
    self.max_health = self.health;
}

export function SP_monster_soldier_ripper(self: Entity, context: SpawnContext): void {
    SP_monster_soldier_x(self, context, 6, 50);
    self.model = 'models/monsters/soldier/tris.md2'; // Ensure correct model
}

export function SP_monster_soldier_hypergun(self: Entity, context: SpawnContext): void {
    SP_monster_soldier_x(self, context, 8, 60);
    self.model = 'models/monsters/soldier/tris.md2';
}

export function SP_monster_soldier_lasergun(self: Entity, context: SpawnContext): void {
    SP_monster_soldier_x(self, context, 10, 70);
    self.model = 'models/monsters/soldier/tris.md2';
}

export function registerMonsterSpawns(registry: SpawnRegistry): void {
  registry.register('monster_soldier', SP_monster_soldier);
  registry.register('monster_soldier_light', SP_monster_soldier_light);
  registry.register('monster_soldier_ssg', SP_monster_soldier_ssg);
  registry.register('monster_soldier_ripper', SP_monster_soldier_ripper);
  registry.register('monster_soldier_hypergun', SP_monster_soldier_hypergun);
  registry.register('monster_soldier_lasergun', SP_monster_soldier_lasergun);
}
