import { normalizeVec3, subtractVec3, Vec3, ZERO_VEC3, lengthVec3, scaleVec3, addVec3, angleVectors } from '@quake2ts/shared';
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
import { throwGibs, GIB_METALLIC } from '../gibs.js';
import { rangeTo, RangeCategory, infront, visible } from '../../ai/perception.js';
import { monster_fire_bullet_v2, monster_fire_rocket, monster_fire_grenade, monster_fire_heat } from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';
import { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;

// Flash offsets (Approximate based on model size)
const SUPERTANK_MACHINEGUN_OFFSET: Vec3 = { x: 30, y: 30, z: 40 }; // Forward, Right, Up
const SUPERTANK_ROCKET_OFFSET: Vec3 = { x: 30, y: -30, z: 40 };
const SUPERTANK_GRENADE_OFFSET: Vec3 = { x: 20, y: 0, z: 70 };

// Wrappers
function monster_ai_stand(self: Entity, dist: number, context: any): void {
  ai_stand(self, dist, context);
}

function monster_ai_walk(self: Entity, dist: number, context: any): void {
  ai_walk(self, dist, context);
}

function monster_ai_run(self: Entity, dist: number, context: any): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

function monster_ai_charge(self: Entity, dist: number, context: any): void {
  ai_charge(self, dist, context);
}

function monster_ai_move(self: Entity, dist: number, context: any): void {
  ai_move(self, dist);
}

// Forward declarations
let stand_move: MonsterMove;
let run_move: MonsterMove;
let attack_rocket_move: MonsterMove;
let attack_grenade_move: MonsterMove;
let attack_chain_move: MonsterMove;
let attack_chain_end_move: MonsterMove;
let pain1_move: MonsterMove;
let pain2_move: MonsterMove;
let pain3_move: MonsterMove;
let death_move: MonsterMove;

function supertank_stand(self: Entity): void {
  self.monsterinfo.current_move = stand_move;
}

function supertank_walk(self: Entity): void {
  self.monsterinfo.current_move = run_move; // Supertank uses run frames for walk
}

function supertank_run(self: Entity): void {
  if (self.enemy && self.enemy.health > 0) {
    self.monsterinfo.current_move = run_move;
  } else {
    self.monsterinfo.current_move = stand_move;
  }
}

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

function supertank_attack(self: Entity, context: EntitySystem): void {
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

    const rng = context.rng.frandom();

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

    if (self.spawnflags & 8) { // SPAWNFLAG_SUPERTANK_POWERSHIELD -> Heat seeker
        monster_fire_heat(self, start, forward, 50, 650, 0, 0.075, context);
    } else {
        monster_fire_rocket(self, start, forward, 50, 650, 0, context);
    }
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


function supertank_reattack1(self: Entity, context: EntitySystem): void {
    const traceFn = (start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, ignore: Entity | null, mask: number) => {
        const tr = context.trace(start, mins, maxs, end, ignore, mask);
        return { fraction: tr.fraction, ent: tr.ent };
    };

    if (self.enemy && visible(self, self.enemy, traceFn) && (context.rng.frandom() < 0.3 || (self.timestamp && self.timestamp >= (Date.now() / 1000)))) {
        self.monsterinfo.current_move = attack_chain_move;
    } else {
        self.monsterinfo.current_move = attack_chain_end_move;
    }
}

function supertank_pain(self: Entity, context: EntitySystem): void {
    if (self.monsterinfo.current_move === pain1_move ||
        self.monsterinfo.current_move === pain2_move ||
        self.monsterinfo.current_move === pain3_move) return;

  // Logic to choose pain animation based on damage?
  // Just random for now or sequential
  const r = context.rng.frandom();
  if (r < 0.33) self.monsterinfo.current_move = pain1_move;
  else if (r < 0.66) self.monsterinfo.current_move = pain2_move;
  else self.monsterinfo.current_move = pain3_move;
}

function supertank_die(self: Entity, context: any): void {
  context.engine.sound?.(self, 0, 'boss1/b1deth1.wav', 1, 1, 0);
  self.monsterinfo.current_move = death_move;
}

function supertank_dead(self: Entity): void {
  self.monsterinfo.nextframe = death_move.lastframe;
  self.nextthink = -1;
}

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


export function SP_monster_supertank(self: Entity, context: SpawnContext): void {
  self.classname = 'monster_supertank';
  self.model = 'models/monsters/boss1/tris.md2';

  // Gibs
  // ... remove precacheModel calls ...

  self.mins = { x: -64, y: -64, z: 0 };
  self.maxs = { x: 64, y: 64, z: 112 }; // From C
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.health = 1500 * context.health_multiplier;
  self.max_health = self.health;
  self.mass = 800;
  self.takedamage = true;

  // Calculate viewheight based on maxs to match C behavior:
  // if (!self->viewheight) self->viewheight = (int) (self->maxs[2] - 8.f);
  // maxs.z is 112, so 112 - 8 = 104.
  self.viewheight = 104;

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
        context.entities.sound?.(self, 0, 'boss1/b1pain1.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain1_move;
    } else if (damage <= 25) {
        context.entities.sound?.(self, 0, 'boss1/b1pain3.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain3_move;
    } else {
        context.entities.sound?.(self, 0, 'boss1/b1pain2.wav', 1, 1, 0);
        self.monsterinfo.current_move = pain2_move;
    }
  };

  self.die = (self, inflictor, attacker, damage, point) => {
    self.deadflag = DeadFlag.Dead;
    self.solid = Solid.Not;

    if (self.health < -80) { // Big boss needs big damage to gib
        context.entities.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
        throwGibs(context.entities, self.origin, damage, GIB_METALLIC);
        context.entities.free(self);
        return;
    }

    supertank_die(self, context.entities);
  };

  self.monsterinfo.stand = supertank_stand;
  self.monsterinfo.walk = supertank_walk;
  self.monsterinfo.run = supertank_run;
  self.monsterinfo.attack = (ent) => supertank_attack(ent, context.entities);
  self.monsterinfo.sight = (self, other) => {
      context.entities.sound?.(self, 0, 'boss1/sight1.wav', 1, 1, 0);
  };

  self.think = monster_think;

  supertank_stand(self);
  self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerSupertankSpawns(registry: SpawnRegistry): void {
  registry.register('monster_supertank', SP_monster_supertank);

  // Boss5 uses same entity but with powershield and skin 2
  registry.register('monster_boss5', (self, ctx) => {
      SP_monster_supertank(self, ctx);
      self.spawnflags |= 8; // SPAWNFLAG_SUPERTANK_POWERSHIELD
      self.skin = 2;
      self.classname = 'monster_boss5';
  });
}
