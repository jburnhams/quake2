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
import { monster_fire_rocket, monster_fire_bullet, monster_fire_grenade } from './attack.js';
import { normalizeVec3, subtractVec3, Vec3, angleVectors, addVec3, scaleVec3, ZERO_VEC3, lengthVec3 } from '@quake2ts/shared';
import { DamageMod } from '../../combat/damageMods.js';
import { rangeTo, RangeCategory, visible } from '../../ai/perception.js';
import type { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;

const MZ2_SUPERTANK_MACHINEGUN_1 = 1;
const MZ2_SUPERTANK_MACHINEGUN_2 = 2; // And so on... (Not used in TS port usually, we pass raw flashtype if needed or handle effects separately)
const MZ2_SUPERTANK_ROCKET_1 = 1;
const MZ2_SUPERTANK_ROCKET_2 = 2;
const MZ2_SUPERTANK_ROCKET_3 = 3;
const MZ2_SUPERTANK_GRENADE_1 = 1;
const MZ2_SUPERTANK_GRENADE_2 = 2;

// Offsets for muzzle flashes/projectiles (Approximate from C code usually in m_flash.c)
// Since we don't have m_flash.c ported fully, we estimate or assume standard offsets
// For Supertank, it has multiple hardpoints.
// We'll calculate them dynamically based on frame or just use approximations.
// C code uses monster_flash_offset array.

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
let attack1_move: MonsterMove; // Chaingun
let attack2_move: MonsterMove; // Rocket
let attack4_move: MonsterMove; // Grenade
let end_attack1_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;

function supertank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function supertank_walk(self: Entity): void {
  self.monsterinfo.current_move = walk_move;
}

function supertank_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function get_time(self: Entity, context: any): number {
    return context.timeSeconds ?? self.timestamp ?? 0;
}

function supertank_reattack1(self: Entity, context: any): void {
  // If visible and chance, loop back to start of attack1
  // In C: if (visible && (time < timestamp || random < 0.3)) -> attack1 else end_attack1

  // Use context.trace (EntitySystem)
  if (self.enemy && visible(self, self.enemy, context.trace)) {
      if ((self.timestamp && self.timestamp >= get_time(self, context)) || Math.random() < 0.3) {
          self.monsterinfo.current_move = attack1_move;
          return;
      }
  }
  self.monsterinfo.current_move = end_attack1_move;
}

function supertank_machinegun(self: Entity, context: any): void {
    if (!self.enemy) return;

    // Approximate offset: Chaingun is on the right arm?
    // We'll use a generic forward offset for now.
    const start = { ...self.origin };
    start.z += self.viewheight;

    // In C: monster_fire_bullet(self, start, forward, 6, 4, DEFAULT_BULLET_HSPREAD * 3, DEFAULT_BULLET_VSPREAD * 3, flash_number);
    // HSPREAD*3 = 300 * 3? No, usually spread is small.
    // Let's use 0.1 for spread.

    const { forward } = angleVectors(self.angles);

    // Fire bullet
    monster_fire_bullet(self, start, forward, 6, 4, 0.1, 0.1, 0, context, DamageMod.MACHINEGUN);
}

function supertank_rocket(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = { ...self.origin };
    start.z += self.viewheight;

    // Calculate direction to enemy
    const dir = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_rocket(self, start, dir, 50, 750, 0, context);
}

function supertank_grenade(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = { ...self.origin };
    start.z += self.viewheight;

    // Grenade aiming logic usually involves predicting lob.
    // For now, fire directly at enemy with speed variation.
    const aim = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_grenade(self, start, aim, 50, 600, 0, context);
}

function supertank_attack(self: Entity, context: any): void {
    if (!self.enemy) return;

    const dist = rangeTo(self, self.enemy);
    const vec = subtractVec3(self.enemy.origin, self.origin);
    const range = lengthVec3(vec);

    // Simple logic approximating C code
    // Check LOS (omitted for now, assume visible if we are attacking)

    const random = Math.random();

    // Fire rockets more often at distance
    if (range > 540 || random < 0.3) {
        // Prefer grenade if enemy is above us
        if (vec.z > 120 || Math.random() < 0.2) {
            self.monsterinfo.current_move = attack4_move;
        } else {
             self.monsterinfo.current_move = attack2_move;
        }
    } else {
        // Chaingun
         self.monsterinfo.current_move = attack1_move;
         self.timestamp = get_time(self, context) + 1.5 + Math.random() * 1.2;
    }
}

function supertank_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: any): void {
  if (self.timestamp < (self.pain_finished_time || 0)) return;

  self.pain_finished_time = get_time(self, context) + 3.0;

  if (damage <= 10) {
      self.monsterinfo.current_move = pain1_move;
  } else if (damage <= 25) {
      self.monsterinfo.current_move = pain2_move;
  } else {
      self.monsterinfo.current_move = pain3_move;
  }
}

function supertank_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

function supertank_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: EntitySystem): void {
    // Check for gibbing
    if (self.health <= -80) { // Big boss gib health
        if (context.sound)
            context.sound(self, 0, 'misc/udeath.wav', 1, 1, 0);
        throwGibs(context, self.origin, damage);
        context.free(self);
        return;
    }

    if (self.deadflag === DeadFlag.Dead) return;

    if (context.sound)
        context.sound(self, 0, 'bosstank/btkdeth1.wav', 1, 1, 0);

    self.deadflag = DeadFlag.Dead;
    self.takedamage = false; // Or true if we want corpse to be gibbable later? C code says takedamage = false usually for normal death anim?
    // C code:
    // if (self->spawnflags & SPAWNFLAG_MONSTER_DEAD) ... check gib ... if (self.deadflag) return;
    // else { sound(death); self.deadflag = true; self.takedamage = false; }
    // M_SetAnimation(death)

    self.monsterinfo.current_move = death_move;
}

// Frame Definitions
// Based on frames.txt

// Attack 1 (Chaingun) 0-19
// start: 0-5 (calls reattack at end)
const attack1_frames: MonsterFrame[] = Array.from({ length: 6 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: supertank_machinegun
}));
attack1_move = {
    firstframe: 0,
    lastframe: 5,
    frames: attack1_frames,
    endfunc: supertank_reattack1
};

// end: 6-19
const end_attack1_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({
    ai: monster_ai_move,
    dist: 0
}));
end_attack1_move = {
    firstframe: 6,
    lastframe: 19,
    frames: end_attack1_frames,
    endfunc: supertank_run
};

// Attack 2 (Rocket) 20-46
const attack2_frames: MonsterFrame[] = Array.from({ length: 27 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 7 || i === 10 || i === 13) ? supertank_rocket : null // Indices 7,10,13 correspond to frames 8,11,14 (0-indexed relative to start 20) -> 27, 30, 33?
    // Wait, C code says FRAME_attak2_8, 11, 14.
    // Frame 20 is FRAME_attak2_1.
    // So FRAME_attak2_8 is 20 + 7 = 27. Correct.
}));
attack2_move = {
    firstframe: 20,
    lastframe: 46,
    frames: attack2_frames,
    endfunc: supertank_run
};

// Attack 3 (Unused/Missing from C logic) 47-73

// Attack 4 (Grenade) 74-79
const attack4_frames: MonsterFrame[] = Array.from({ length: 6 }, (_, i) => ({
    ai: monster_ai_move,
    dist: 0,
    think: (i === 0 || i === 3) ? supertank_grenade : null // FRAME_attak4_1 and 4 -> indices 0 and 3 relative to start
}));
attack4_move = {
    firstframe: 74,
    lastframe: 79,
    frames: attack4_frames,
    endfunc: supertank_run
};

// Death 98-121 (24 frames)
const death_frames: MonsterFrame[] = Array.from({ length: 24 }, (_, i) => ({
    ai: monster_ai_move,
    dist: 0,
    think: (i === 23) ? ((self: Entity) => { /* Explode logic? */ }) : null
}));
death_move = {
    firstframe: 98,
    lastframe: 121,
    frames: death_frames,
    endfunc: supertank_dead
};

// Forward (Walk/Run) 128-145
const forward_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
    ai: monster_ai_run,
    dist: 12 // Speed from C code
}));
run_move = {
    firstframe: 128,
    lastframe: 145,
    frames: forward_frames,
    endfunc: supertank_run
};
walk_move = {
    firstframe: 128,
    lastframe: 145,
    frames: forward_frames.map(f => ({ ...f, ai: monster_ai_walk, dist: 4 })), // Slower speed for walk
    endfunc: supertank_walk
};

// Pain 1: 164-167
const pain1_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain1_move = { firstframe: 164, lastframe: 167, frames: pain1_frames, endfunc: supertank_run };

// Pain 2: 168-171
const pain2_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain2_move = { firstframe: 168, lastframe: 171, frames: pain2_frames, endfunc: supertank_run };

// Pain 3: 172-175
const pain3_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain3_move = { firstframe: 172, lastframe: 175, frames: pain3_frames, endfunc: supertank_run };

// Stand: 194-253
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({ ai: monster_ai_stand, dist: 0 }));
stand_move = { firstframe: 194, lastframe: 253, frames: stand_frames, endfunc: supertank_stand };


export function SP_monster_supertank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_supertank';
  self.model = 'models/monsters/boss1/tris.md2';
  self.mins = { x: -64, y: -64, z: 0 }; // C code: -64, -64, 0
  self.maxs = { x: 64, y: 64, z: 112 }; // C code: 64, 64, 112
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 1500;
  self.max_health = 1500;
  self.mass = 800;
  self.takedamage = true;
  self.viewheight = 64; // Approximation

  self.pain = (ent, other, kick, dmg) => supertank_pain(ent, other, kick, dmg, context.entities);

  self.die = (ent, inflictor, attacker, damage, point) => supertank_die(ent, inflictor, attacker, damage, point, context.entities);

  self.monsterinfo.stand = supertank_stand;
  self.monsterinfo.walk = supertank_walk;
  self.monsterinfo.run = supertank_run;
  self.monsterinfo.attack = (ent) => supertank_attack(ent, context.entities);
  self.monsterinfo.checkattack = undefined; // Use default

  self.think = monster_think;

  supertank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', SP_monster_supertank);
  // boss5 is the same but with power armor and different skin
  registry.register('monster_boss5', (self, ctx) => {
      SP_monster_supertank(self, ctx);
      self.classname = 'monster_boss5';
      self.skin = 2;
      // Power shield logic would go here
  });
}
