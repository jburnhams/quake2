<<<<<<< HEAD
<<<<<<< HEAD
=======
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, lengthVec3, scaleVec3, addVec3, angleVectors } from '@quake2ts/shared';
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, lengthVec3, scaleVec3, addVec3, angleVectors } from '@quake2ts/shared';
>>>>>>> origin/main
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
<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> origin/main
import { rangeTo, RangeCategory, infront, visible } from '../../ai/perception.js';
import { monster_fire_bullet_v2, monster_fire_rocket, monster_fire_grenade, monster_fire_heat } from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

// Flash offsets (Approximate based on model size)
const SUPERTANK_MACHINEGUN_OFFSET: Vec3 = { x: 30, y: 30, z: 40 }; // Forward, Right, Up
const SUPERTANK_ROCKET_OFFSET: Vec3 = { x: 30, y: -30, z: 40 };
const SUPERTANK_GRENADE_OFFSET: Vec3 = { x: 20, y: 0, z: 70 };
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
<<<<<<< HEAD
<<<<<<< HEAD
  ai_run(self, dist, MONSTER_TICK, context);
=======
=======
>>>>>>> origin/main
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
<<<<<<< HEAD
<<<<<<< HEAD
let walk_move: MonsterMove;
let run_move: MonsterMove;
let attack1_move: MonsterMove; // Chaingun
let attack2_move: MonsterMove; // Rocket
let attack4_move: MonsterMove; // Grenade
let end_attack1_move: MonsterMove;
=======
=======
>>>>>>> origin/main
let run_move: MonsterMove;
let attack_rocket_move: MonsterMove;
let attack_grenade_move: MonsterMove;
let attack_chain_move: MonsterMove;
let attack_chain_end_move: MonsterMove;
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;

function supertank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function supertank_walk(self: Entity): void {
<<<<<<< HEAD
<<<<<<< HEAD
  self.monsterinfo.current_move = walk_move;
=======
  self.monsterinfo.current_move = run_move; // Supertank uses run frames for walk
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
  self.monsterinfo.current_move = run_move; // Supertank uses run frames for walk
>>>>>>> origin/main
}

function supertank_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> origin/main
function getProjectedOffset(self: Entity, offset: Vec3): Vec3 {
    const { forward, right, up } = angleVectors(self.angles);
    const start = { ...self.origin };

    // Project offset: forward * x + right * y + up * z
    const x = scaleVec3(forward, offset.x);
    const y = scaleVec3(right, offset.y); // y is right
    const z = scaleVec3(up, offset.z);

    return addVec3(addVec3(addVec3(start, x), y), z);
}

function checkClearShot(self: Entity, offset: Vec3, context: any): boolean {
    if (!self.enemy) return false;

    const start = getProjectedOffset(self, offset);
    const end = { ...self.enemy.origin };
    end.z += (self.enemy.viewheight || 0);

    const tr = context.trace(start, end, ZERO_VEC3, ZERO_VEC3, self, 1 | 0x80); // MASK_OPAQUE roughly

    if (tr.fraction === 1.0 || tr.ent === self.enemy) {
        return true;
    }
    return false;
}

function supertank_attack(self: Entity): void {
    if (!self.enemy) return;

    const vec = subtractVec3(self.enemy.origin, self.origin);
    const range = lengthVec3(vec);

    // Using simple logic to mimic C check
    // In C, it checks clear shot for each weapon
    // Since we don't have the context here easily for trace, we'll assume clear if visible for now,
    // or rely on the firing function to check, but for selection we might just random.
    // However, better to assume we can fire if we are here.

    // Logic from C:
    // fire rockets more often at distance
    // prefer grenade if enemy is above

    const isAbove = (self.enemy.origin.z - self.origin.z) > 120;
    const isFar = range > 540;

    const rng = Math.random();

    // Simplify:
    // 1. If far or random, try rocket
    // 2. If close, try chaingun
    // 3. If above, try grenade

    if (isAbove && rng < 0.7) {
        self.monsterinfo.current_move = attack_grenade_move;
        return;
    }

    if (isFar) {
         if (rng < 0.3) self.monsterinfo.current_move = attack_chain_move;
         else if (rng < 0.8) self.monsterinfo.current_move = attack_rocket_move;
         else self.monsterinfo.current_move = attack_grenade_move;
    } else {
        if (rng < 0.5) self.monsterinfo.current_move = attack_chain_move;
        else if (rng < 0.9) self.monsterinfo.current_move = attack_rocket_move;
        else self.monsterinfo.current_move = attack_grenade_move;
    }
}

function supertank_fire_rocket(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = getProjectedOffset(self, SUPERTANK_ROCKET_OFFSET);
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // If powershield spawnflag (8), fire heat seeker? Not implemented yet.
    // Just fire normal rocket for now.

    monster_fire_rocket(self, start, forward, 50, 650, 0, context);
}

function supertank_fire_grenade(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = getProjectedOffset(self, SUPERTANK_GRENADE_OFFSET);

    // Predict aim not fully implemented, just aim at enemy
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    // Try to calculate pitch?
    // For now, simple direct fire logic used in monster_fire_grenade
    monster_fire_grenade(self, start, forward, 50, 600, 0, context);
}

function supertank_fire_machinegun(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start = getProjectedOffset(self, SUPERTANK_MACHINEGUN_OFFSET);
    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    monster_fire_bullet_v2(self, start, forward, 6, 4, 0.05, 0.05, 0, context, DamageMod.MACHINEGUN);
}


function supertank_reattack1(self: Entity, context: any): void {
    const traceFn = (start: Vec3, end: Vec3, ignore: Entity, mask: number) => {
        const tr = context.trace(start, null, null, end, ignore, mask);
        return { fraction: tr.fraction, entity: tr.ent };
    };

    if (self.enemy && visible(self, self.enemy, traceFn) && (Math.random() < 0.3 || (self.timestamp && self.timestamp >= (Date.now() / 1000)))) {
        self.monsterinfo.current_move = attack_chain_move;
    } else {
        self.monsterinfo.current_move = attack_chain_end_move;
    }
}

function supertank_pain(self: Entity): void {
    if (self.monsterinfo.current_move === pain1_move ||
        self.monsterinfo.current_move === pain2_move ||
        self.monsterinfo.current_move === pain3_move) return;

  // Logic to choose pain animation based on damage?
  // Just random for now or sequential
  const r = Math.random();
  if (r < 0.33) self.monsterinfo.current_move = pain1_move;
  else if (r < 0.66) self.monsterinfo.current_move = pain2_move;
  else self.monsterinfo.current_move = pain3_move;
}

function supertank_die(self: Entity): void {
  self.monsterinfo.current_move = death_move;
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
}

function supertank_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

<<<<<<< HEAD
<<<<<<< HEAD
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
=======
=======
>>>>>>> origin/main
// Frame Definitions matching C++ lengths roughly

// Stand: 60 frames
const stand_frames: MonsterFrame[] = Array.from({ length: 60 }, () => ({
  ai: monster_ai_stand,
  dist: 0,
}));

stand_move = {
  firstframe: 0,
  lastframe: 59,
  frames: stand_frames,
  endfunc: supertank_stand,
};

// Run: 18 frames
const run_frames: MonsterFrame[] = Array.from({ length: 18 }, () => ({
  ai: monster_ai_run,
  dist: 12, // Approx from C
}));

run_move = {
  firstframe: 60,
  lastframe: 77,
  frames: run_frames,
  endfunc: supertank_run,
};

// Pain 3: 4 frames
const pain3_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain3_move = { firstframe: 78, lastframe: 81, frames: pain3_frames, endfunc: supertank_run };

// Pain 2: 4 frames
const pain2_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain2_move = { firstframe: 82, lastframe: 85, frames: pain2_frames, endfunc: supertank_run };

// Pain 1: 4 frames
const pain1_frames: MonsterFrame[] = Array.from({ length: 4 }, () => ({ ai: monster_ai_move, dist: 0 }));
pain1_move = { firstframe: 86, lastframe: 89, frames: pain1_frames, endfunc: supertank_run };

// Death: 24 frames
const death_frames: MonsterFrame[] = Array.from({ length: 24 }, () => ({ ai: monster_ai_move, dist: 0 }));
death_move = { firstframe: 90, lastframe: 113, frames: death_frames, endfunc: supertank_dead };

// Attack 4 (Grenade): 6 frames
const attack_grenade_frames: MonsterFrame[] = Array.from({ length: 6 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 0 || i === 3) ? supertank_fire_grenade : null
}));
attack_grenade_move = { firstframe: 114, lastframe: 119, frames: attack_grenade_frames, endfunc: supertank_run };

// Attack 2 (Rocket): 27 frames
const attack_rocket_frames: MonsterFrame[] = Array.from({ length: 27 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: (i === 7 || i === 10 || i === 13) ? supertank_fire_rocket : null // Indices 7, 10, 13 (frame 8, 11, 14)
}));
attack_rocket_move = { firstframe: 120, lastframe: 146, frames: attack_rocket_frames, endfunc: supertank_run };

// Attack 1 (Chaingun): 6 frames (fire loop)
const attack_chain_frames: MonsterFrame[] = Array.from({ length: 6 }, () => ({
    ai: monster_ai_charge,
    dist: 0,
    think: supertank_fire_machinegun
}));
attack_chain_move = { firstframe: 147, lastframe: 152, frames: attack_chain_frames, endfunc: supertank_reattack1 };

// Attack 1 End: 14 frames
const attack_chain_end_frames: MonsterFrame[] = Array.from({ length: 14 }, () => ({ ai: monster_ai_move, dist: 0 }));
attack_chain_end_move = { firstframe: 153, lastframe: 166, frames: attack_chain_end_frames, endfunc: supertank_run };
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main


export function SP_monster_supertank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_supertank';
  self.model = 'models/monsters/boss1/tris.md2';
<<<<<<< HEAD
<<<<<<< HEAD
  self.mins = { x: -64, y: -64, z: 0 }; // C code: -64, -64, 0
  self.maxs = { x: 64, y: 64, z: 112 }; // C code: 64, 64, 112
=======
=======
>>>>>>> origin/main

  // Gibs
  // ... remove precacheModel calls ...

  self.mins = { x: -64, y: -64, z: 0 };
  self.maxs = { x: 64, y: 64, z: 112 }; // From C
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 1500;
  self.max_health = 1500;
  self.mass = 800;
  self.takedamage = true;
<<<<<<< HEAD
<<<<<<< HEAD
  self.viewheight = 64; // Approximation

  self.pain = (ent, other, kick, dmg) => supertank_pain(ent, other, kick, dmg, context.entities);

  self.die = (ent, inflictor, attacker, damage, point) => supertank_die(ent, inflictor, attacker, damage, point, context.entities);
=======
=======
>>>>>>> origin/main
  self.viewheight = 64; // Guess, maybe higher?

  self.pain = (self, other, kick, damage) => {
    // Skin change on damage
    if (self.health < (self.max_health / 2)) {
      self.skin = (self.skin || 0) | 1;
    } else {
      self.skin = (self.skin || 0) & ~1;
    }

    if (self.timestamp < (self.pain_finished_time || 0)) return;
    self.pain_finished_time = self.timestamp + 3.0;

    // Don't pain if firing rockets (Attak2 frames 1-14? approx)
    // Check frame number vs absolute, assuming current_move
    if (self.monsterinfo.current_move === attack_rocket_move && (self.monsterinfo.nextframe || 0) < attack_rocket_move.firstframe + 14) return;

    if (damage <= 10) {
        // play pain1 sound
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= 25) {
        // play pain3 sound
        self.monsterinfo.current_move = pain3_move;
    } else {
        // play pain2 sound
        self.monsterinfo.current_move = pain2_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -80) { // Big boss needs big damage to gib
        throwGibs(context.entities, self.origin, damage);
        context.entities.free(self);
        return;
    }

    supertank_die(self);
  };
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main

  self.monsterinfo.stand = supertank_stand;
  self.monsterinfo.walk = supertank_walk;
  self.monsterinfo.run = supertank_run;
<<<<<<< HEAD
<<<<<<< HEAD
  self.monsterinfo.attack = (ent) => supertank_attack(ent, context.entities);
  self.monsterinfo.checkattack = undefined; // Use default
=======
  self.monsterinfo.attack = supertank_attack;
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
  self.monsterinfo.attack = supertank_attack;
>>>>>>> origin/main

  self.think = monster_think;

  supertank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', SP_monster_supertank);
<<<<<<< HEAD
<<<<<<< HEAD
  // boss5 is the same but with power armor and different skin
  registry.register('monster_boss5', (self, ctx) => {
      SP_monster_supertank(self, ctx);
      self.classname = 'monster_boss5';
      self.skin = 2;
      // Power shield logic would go here
=======
=======
>>>>>>> origin/main

  // Boss5 uses same entity but with powershield and skin 2
  registry.register('monster_boss5', (self, ctx) => {
      SP_monster_supertank(self, ctx);
      self.spawnflags |= 8; // SPAWNFLAG_SUPERTANK_POWERSHIELD
      self.skin = 2;
      self.classname = 'monster_boss5';
<<<<<<< HEAD
>>>>>>> 40ca6857d501c73b890d6872b901150001e7151e
=======
>>>>>>> origin/main
  });
}
