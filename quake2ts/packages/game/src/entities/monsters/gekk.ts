import {
  angleVectors,
  addVec3,
  scaleVec3,
  subtractVec3,
  normalizeVec3,
  vectorToAngles,
  lengthVec3,
  Vec3,
  ZERO_VEC3,
  copyVec3
} from '@quake2ts/shared';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  ai_turn
} from '../../ai/index.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  DeadFlag,
  Entity,
  MonsterFrame,
  MonsterMove,
  MoveType,
  Solid,
  EntityFlags,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { throwGibs } from '../gibs.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { M_CheckBottom } from '../../ai/movement.js';
import { EntitySystem } from '../system.js';
import { createBlasterBolt } from '../projectiles.js';

type MutableVec3 = { -readonly [P in keyof Vec3]: Vec3[P] };

const MONSTER_TICK = 0.1;

// Helper to access deterministic RNG or Math.random
const random = () => Math.random();
const frandom = () => Math.random();
const irandom = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Wrappers for AI functions
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
let gekk_move_stand: MonsterMove;
let gekk_move_standunderwater: MonsterMove;
let gekk_move_swim_loop: MonsterMove;
let gekk_move_swim_start: MonsterMove;
let gekk_move_chant: MonsterMove;
let gekk_move_idle: MonsterMove;
let gekk_move_idle2: MonsterMove;
let gekk_move_walk: MonsterMove;
let gekk_move_run: MonsterMove;
let gekk_move_run_start: MonsterMove;
let gekk_move_attack1: MonsterMove;
let gekk_move_attack2: MonsterMove;
let gekk_move_spit: MonsterMove;
let gekk_move_leapatk: MonsterMove;
let gekk_move_leapatk2: MonsterMove;
let gekk_move_attack: MonsterMove;
let gekk_move_pain: MonsterMove;
let gekk_move_pain1: MonsterMove;
let gekk_move_pain2: MonsterMove;
let gekk_move_death1: MonsterMove;
let gekk_move_death3: MonsterMove;
let gekk_move_death4: MonsterMove;
let gekk_move_wdeath: MonsterMove;

const WATER_WAIST = 2; // Approximate water level
const RANGE_MELEE = 80;
const RANGE_NEAR = 100;
const RANGE_MID = 400; // Guess
const SPAWNFLAG_GEKK_CHANT = 8;
const SPAWNFLAG_GEKK_NOJUMPING = 16;
const SPAWNFLAG_GEKK_NOSWIM = 32;
const GIB_HEALTH = -30;

// Functions
function gekk_check_underwater(self: Entity, context: EntitySystem): void {
    if (!(self.spawnflags & SPAWNFLAG_GEKK_NOSWIM) && (self.waterlevel >= WATER_WAIST)) {
        land_to_water(self);
    }
}

function gekk_stand(self: Entity): void {
    if (self.waterlevel >= WATER_WAIST) {
        self.flags |= EntityFlags.Swim;
        self.monsterinfo.current_move = gekk_move_standunderwater;
    } else {
        if (self.monsterinfo.current_move !== gekk_move_chant) {
             self.monsterinfo.current_move = gekk_move_stand;
        }
    }
}

function gekk_swim_loop_func(self: Entity): void {
    self.flags |= EntityFlags.Swim;
    self.monsterinfo.current_move = gekk_move_swim_loop;
}

function gekk_hit_left(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const damage = irandom(5, 10);
    const range = 100;
    const dir = subtractVec3(self.enemy.origin, self.origin);
    const dist = lengthVec3(dir);

    if (dist <= range) {
         context.engine.sound?.(self, 0, 'gek/gk_atck2.wav', 1, 1, 0);
         T_Damage(self.enemy as any, self as any, self as any, normalizeVec3(dir), self.enemy.origin, ZERO_VEC3, damage, damage, 0, DamageMod.UNKNOWN, context.timeSeconds);
    } else {
         context.engine.sound?.(self, 0, 'gek/gk_atck1.wav', 1, 1, 0);
    }
}

function gekk_hit_right(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    const damage = irandom(5, 10);
    const range = 100;
    const dir = subtractVec3(self.enemy.origin, self.origin);
    const dist = lengthVec3(dir);

    if (dist <= range) {
         context.engine.sound?.(self, 0, 'gek/gk_atck3.wav', 1, 1, 0);
         T_Damage(self.enemy as any, self as any, self as any, normalizeVec3(dir), self.enemy.origin, ZERO_VEC3, damage, damage, 0, DamageMod.UNKNOWN, context.timeSeconds);
    } else {
         context.engine.sound?.(self, 0, 'gek/gk_atck1.wav', 1, 1, 0);
    }
}

function gekk_bite(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
     const damage = 5;
    const range = RANGE_MELEE;
    const dir = subtractVec3(self.enemy.origin, self.origin);
    const dist = lengthVec3(dir);

    if (dist <= range) {
        T_Damage(self.enemy as any, self as any, self as any, normalizeVec3(dir), self.enemy.origin, ZERO_VEC3, damage, 0, 0, DamageMod.UNKNOWN, context.timeSeconds);
    }
}

function gekk_check_melee(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy || self.enemy.health <= 0 || (self.monsterinfo.melee_debounce_time && self.monsterinfo.melee_debounce_time > context.timeSeconds))
        return false;

    const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
    return dist <= RANGE_MELEE;
}

function gekk_check_jump(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy) return false;

    // don't jump if there's no way we can reach standing height
    if (self.absmin.z + 125 < self.enemy.absmin.z)
        return false;

    const v = subtractVec3(self.origin, self.enemy.origin);
    (v as MutableVec3).z = 0;
    const distance = lengthVec3(v);

    if (distance < 100) return false;
    if (distance > 100) {
        if (frandom() < (self.waterlevel >= WATER_WAIST ? 0.2 : 0.9))
            return false;
    }

    return true;
}

function gekk_check_jump_close(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy) return false;
    const v = subtractVec3(self.origin, self.enemy.origin);
    (v as MutableVec3).z = 0;
    const distance = lengthVec3(v);

    if (distance < 100) {
        if (self.absmax.z <= self.enemy.absmin.z) return false;
    }
    return true;
}

function gekk_checkattack(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy || self.enemy.health <= 0) return false;

    if (gekk_check_melee(self, context)) {
        return true;
    }

    if (gekk_check_jump(self, context)) {
        return true;
    }

    if (gekk_check_jump_close(self, context) && !(self.flags & EntityFlags.Swim)) {
        return true;
    }

    return false;
}

function gekk_swim(self: Entity): void {
    self.monsterinfo.current_move = gekk_move_swim_start;
}

function gekk_chant(self: Entity): void {
    self.monsterinfo.current_move = gekk_move_chant;
}

function gekk_idle_loop(self: Entity): void {
    if (frandom() > 0.75 && self.health < self.max_health) {
        self.monsterinfo.nextframe = 0; // FRAME_idle_01
    }
}

function gekk_step(self: Entity, context: EntitySystem): void {
    const n = irandom(0, 2);
    const sounds = ['gek/gk_step1.wav', 'gek/gk_step2.wav', 'gek/gk_step3.wav'];
    context.engine.sound?.(self, 0, sounds[n], 1, 1, 0);
}

function gekk_search(self: Entity, context: EntitySystem): void {
    if (self.spawnflags & SPAWNFLAG_GEKK_CHANT) {
        const r = frandom();
        if (r < 0.33) context.engine.sound?.(self, 0, 'gek/gek_low.wav', 1, 1, 0);
        else if (r < 0.66) context.engine.sound?.(self, 0, 'gek/gek_mid.wav', 1, 1, 0);
        else context.engine.sound?.(self, 0, 'gek/gek_high.wav', 1, 1, 0);
    } else {
        context.engine.sound?.(self, 0, 'gek/gk_idle1.wav', 1, 1, 0);
    }

    self.health += irandom(10, 20);
    if (self.health > self.max_health) self.health = self.max_health;

    // setskin logic
    if (self.health < (self.max_health / 4)) self.skin = 2;
    else if (self.health < (self.max_health / 2)) self.skin = 1;
    else self.skin = 0;
}

function gekk_run_start(self: Entity): void {
    if (!(self.spawnflags & SPAWNFLAG_GEKK_NOSWIM) && self.waterlevel >= WATER_WAIST) {
        self.monsterinfo.current_move = gekk_move_swim_start;
    } else {
        self.monsterinfo.current_move = gekk_move_run_start;
    }
}

function gekk_run(self: Entity): void {
    if (!(self.spawnflags & SPAWNFLAG_GEKK_NOSWIM) && self.waterlevel >= WATER_WAIST) {
        self.monsterinfo.current_move = gekk_move_swim_start;
    } else {
        self.monsterinfo.current_move = gekk_move_run;
    }
}

function gekk_check_refire(self: Entity): void {
    if (!self.enemy || self.enemy.health <= 0) return;
    const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
    if (dist <= RANGE_MELEE) {
        if (self.frame === 114) { // FRAME_clawatk3_09
            self.monsterinfo.current_move = gekk_move_attack2;
        } else if (self.frame === 123) { // FRAME_clawatk5_09
             self.monsterinfo.current_move = gekk_move_attack1;
        }
    }
}

function fire_loogie(self: Entity, start: Vec3, dir: Vec3, damage: number, speed: number, context: EntitySystem): void {
    const bolt = createBlasterBolt(context, self, start, dir, damage, speed, DamageMod.UNKNOWN);
    bolt.model = 'models/objects/loogy/tris.md2';
}

function loogie_fire(self: Entity, context: EntitySystem): void {
    if (!self.enemy || self.enemy.health <= 0) return;

    const vectors = angleVectors(self.angles);
    const forward = vectors.forward;
    const right = vectors.right;
    const up = vectors.up;

    const offset = { x: -18, y: -0.8, z: 24 };
    const start = addVec3(self.origin, addVec3(scaleVec3(forward, offset.x), addVec3(scaleVec3(right, offset.y), scaleVec3(up, offset.z))));
    (start as MutableVec3).z += 2; // up * 2

    const end = copyVec3(self.enemy.origin);
    (end as MutableVec3).z += (self.enemy.viewheight || 0);
    const dir = normalizeVec3(subtractVec3(end, start));

    fire_loogie(self, start, dir, 5, 550, context);
    context.engine.sound?.(self, 0, 'gek/gk_atck4.wav', 1, 1, 0);
}

function reloogie(self: Entity): void {
    if (frandom() > 0.8 && self.health < self.max_health) {
        self.monsterinfo.current_move = gekk_move_idle2;
        return;
    }
    if (self.enemy && self.enemy.health > 0) {
         const dist = lengthVec3(subtractVec3(self.enemy.origin, self.origin));
         if (frandom() > 0.7 && dist <= RANGE_NEAR) {
              self.monsterinfo.current_move = gekk_move_spit;
         }
    }
}

function gekk_jump_touch(self: Entity, other: Entity | null, plane?: any, surf?: any): void {
    if (self.health <= 0) {
        self.touch = undefined;
        return;
    }

    self.touch = undefined;
}

function gekk_jump_takeoff(self: Entity, context: EntitySystem): void {
    const vectors = angleVectors(self.angles);
    const forward = vectors.forward;

    context.engine.sound?.(self, 0, 'gek/gk_sght1.wav', 1, 1, 0);
    (self.origin as MutableVec3).z += 1;

    self.velocity = addVec3(scaleVec3(forward, 700), { x: 0, y: 0, z: 250 });

    self.groundentity = null;
    self.touch = gekk_jump_touch;
}

function gekk_check_landing(self: Entity, context: EntitySystem): void {
    if (self.groundentity) {
        context.engine.sound?.(self, 0, 'mutant/thud1.wav', 1, 1, 0);
        self.velocity = ZERO_VEC3;
        return;
    }
}

function gekk_stop_skid(self: Entity): void {
    if (self.groundentity) self.velocity = ZERO_VEC3;
}

function gekk_preattack(self: Entity, context: EntitySystem): void {
    // sound
}

function gekk_dead(self: Entity): void {
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
    self.nextthink = -1;
}

function gekk_gibfest(self: Entity, context: EntitySystem): void {
    throwGibs(context, self.origin, 20);
    self.deadflag = DeadFlag.Dead;
}

function isgibfest(self: Entity, context: EntitySystem): void {
    if (frandom() > 0.9) gekk_gibfest(self, context);
}

function gekk_shrink(self: Entity): void {
    (self.maxs as MutableVec3).z = 0;
}

function water_to_land(self: Entity): void {
    self.flags &= ~EntityFlags.Swim;
    self.yaw_speed = 20;
    self.viewheight = 25;
    self.monsterinfo.current_move = gekk_move_leapatk2;
    self.mins = { x: -18, y: -18, z: -24 };
    self.maxs = { x: 18, y: 18, z: 24 };
}

function land_to_water(self: Entity): void {
    self.flags |= EntityFlags.Swim;
    self.yaw_speed = 10;
    self.viewheight = 10;
    self.monsterinfo.current_move = gekk_move_swim_start;
    self.mins = { x: -18, y: -18, z: -24 };
    self.maxs = { x: 18, y: 18, z: 16 };
}


// Frames

// STAND
const frames_stand: MonsterFrame[] = Array(38).fill({ ai: monster_ai_stand, dist: 0 });
frames_stand[38] = { ai: monster_ai_stand, dist: 0, think: gekk_check_underwater };

gekk_move_stand = {
    firstframe: 0,
    lastframe: 38,
    frames: frames_stand,
    endfunc: null
};

// STAND UNDERWATER
const frames_standunderwater: MonsterFrame[] = Array(32).fill({ ai: monster_ai_stand, dist: 14 });
gekk_move_standunderwater = {
    firstframe: 39,
    lastframe: 70,
    frames: frames_standunderwater,
    endfunc: null
};

// SWIM LOOP
const frames_swim: MonsterFrame[] = Array(32).fill({ ai: monster_ai_run, dist: 14 });
gekk_move_swim_loop = {
    firstframe: 39,
    lastframe: 70,
    frames: frames_swim,
    endfunc: gekk_swim_loop_func
};

// SWIM START
const frames_swim_start: MonsterFrame[] = Array(32).fill({ ai: monster_ai_run, dist: 14 });
frames_swim_start[8] = { ai: monster_ai_run, dist: 18, think: gekk_hit_left };
frames_swim_start[14] = { ai: monster_ai_run, dist: 24, think: gekk_hit_right };
frames_swim_start[20] = { ai: monster_ai_run, dist: 22, think: gekk_bite };

gekk_move_swim_start = {
    firstframe: 39,
    lastframe: 70,
    frames: frames_swim_start,
    endfunc: gekk_swim_loop_func
};

// IDLE
const frames_idle: MonsterFrame[] = Array(32).fill({ ai: monster_ai_stand, dist: 0 });
frames_idle[0] = { ai: monster_ai_stand, dist: 0, think: gekk_search };
frames_idle[31] = { ai: monster_ai_stand, dist: 0, think: gekk_idle_loop };
gekk_move_idle = {
    firstframe: 71,
    lastframe: 102,
    frames: frames_idle,
    endfunc: gekk_stand
};

// IDLE 2 (Chant uses this with ai_move?)
const frames_idle2: MonsterFrame[] = Array(32).fill({ ai: monster_ai_move, dist: 0 });
frames_idle2[0] = { ai: monster_ai_move, dist: 0, think: gekk_search };
frames_idle2[31] = { ai: monster_ai_move, dist: 0, think: gekk_idle_loop };
gekk_move_idle2 = {
    firstframe: 71,
    lastframe: 102,
    frames: frames_idle2,
    endfunc: (s) => M_SetAnimation(s, gekk_move_stand) // or face
};

gekk_move_chant = {
    firstframe: 71,
    lastframe: 102,
    frames: frames_idle2,
    endfunc: gekk_chant
};

// WALK
const frames_walk = [
    { ai: monster_ai_walk, dist: 3.8, think: gekk_check_underwater },
    { ai: monster_ai_walk, dist: 19.6 },
    { ai: monster_ai_walk, dist: 25.5 },
    { ai: monster_ai_walk, dist: 34.6, think: gekk_step },
    { ai: monster_ai_walk, dist: 27.3 },
    { ai: monster_ai_walk, dist: 28.4 },
];
gekk_move_walk = {
    firstframe: 103,
    lastframe: 108,
    frames: frames_walk,
    endfunc: null
};

// RUN
const frames_run = [
    { ai: monster_ai_run, dist: 3.8, think: gekk_check_underwater },
    { ai: monster_ai_run, dist: 19.6 },
    { ai: monster_ai_run, dist: 25.5 },
    { ai: monster_ai_run, dist: 34.6, think: gekk_step },
    { ai: monster_ai_run, dist: 27.3 },
    { ai: monster_ai_run, dist: 28.4 },
];
gekk_move_run = {
    firstframe: 103,
    lastframe: 108,
    frames: frames_run,
    endfunc: null
};

// RUN START
const frames_run_st = [
    { ai: monster_ai_run, dist: 0.2 },
    { ai: monster_ai_run, dist: 19.7 },
];
gekk_move_run_start = {
    firstframe: 0,
    lastframe: 1, // Frames 0 and 1 reuse stand start? C says FRAME_stand_01, FRAME_stand_02
    frames: frames_run_st,
    endfunc: gekk_run
};

// SPIT
const frames_spit: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: loogie_fire },
    { ai: monster_ai_charge, dist: 0, think: reloogie },
];
gekk_move_spit = {
    firstframe: 133, // FRAME_spit_01
    lastframe: 139,
    frames: frames_spit,
    endfunc: gekk_run_start
};

// ATTACK 1
const frames_attack1: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: gekk_hit_left },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: gekk_check_refire },
];
gekk_move_attack1 = {
    firstframe: 109,
    lastframe: 117,
    frames: frames_attack1,
    endfunc: gekk_run_start
};

// ATTACK 2
const frames_attack2: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: gekk_hit_left },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: gekk_hit_right },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: 0, think: gekk_check_refire },
];
gekk_move_attack2 = {
    firstframe: 118,
    lastframe: 126,
    frames: frames_attack2,
    endfunc: gekk_run_start
};

// LEAP ATK
const frames_leapatk: MonsterFrame[] = [
    { ai: monster_ai_charge, dist: 0 },
    { ai: monster_ai_charge, dist: -0.3 },
    { ai: monster_ai_charge, dist: -1.1 },
    { ai: monster_ai_charge, dist: -0.2 },
    { ai: monster_ai_charge, dist: 6.7, think: gekk_jump_takeoff },
    { ai: monster_ai_charge, dist: 6.4 },
    { ai: monster_ai_charge, dist: 0.1 },
    { ai: monster_ai_charge, dist: 28.3 },
    { ai: monster_ai_charge, dist: 24.1 },
    { ai: monster_ai_charge, dist: 31.7 },
    { ai: monster_ai_charge, dist: 35.9, think: gekk_check_landing },
    { ai: monster_ai_charge, dist: 12.3, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: 20.1, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: -1.0, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: 2.5, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: 0.5, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: 1.8, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: 1.2, think: gekk_stop_skid },
    { ai: monster_ai_charge, dist: -0.4, think: gekk_check_underwater },
];
gekk_move_leapatk = {
    firstframe: 140,
    lastframe: 158,
    frames: frames_leapatk,
    endfunc: gekk_run_start
};

// LEAP ATK 2 (Same frames but used for water_to_land transition logic if needed)
gekk_move_leapatk2 = {
    firstframe: 140,
    lastframe: 158,
    frames: frames_leapatk, // reusing frames
    endfunc: gekk_run_start
};

// ATTACK (Swim?)
const frames_attack: MonsterFrame[] = Array(21).fill({ ai: monster_ai_charge, dist: 16 });
frames_attack[0] = { ai: monster_ai_charge, dist: 16, think: gekk_preattack };
frames_attack[4] = { ai: monster_ai_charge, dist: 16, think: gekk_bite };
frames_attack[9] = { ai: monster_ai_charge, dist: 16, think: gekk_bite };
frames_attack[13] = { ai: monster_ai_charge, dist: 16, think: gekk_hit_left };
frames_attack[18] = { ai: monster_ai_charge, dist: 16, think: gekk_hit_right };

gekk_move_attack = {
    firstframe: 159,
    lastframe: 179,
    frames: frames_attack,
    endfunc: gekk_run_start
};

// PAIN
const frames_pain: MonsterFrame[] = Array(6).fill({ ai: monster_ai_move, dist: 0 });
gekk_move_pain = {
    firstframe: 180,
    lastframe: 185,
    frames: frames_pain,
    endfunc: gekk_run_start
};

const frames_pain1: MonsterFrame[] = Array(11).fill({ ai: monster_ai_move, dist: 0 });
frames_pain1[10] = { ai: monster_ai_move, dist: 0, think: gekk_check_underwater };
gekk_move_pain1 = {
    firstframe: 186,
    lastframe: 196,
    frames: frames_pain1,
    endfunc: gekk_run_start
};

const frames_pain2: MonsterFrame[] = Array(13).fill({ ai: monster_ai_move, dist: 0 });
frames_pain2[12] = { ai: monster_ai_move, dist: 0, think: gekk_check_underwater };
gekk_move_pain2 = {
    firstframe: 197,
    lastframe: 209,
    frames: frames_pain2,
    endfunc: gekk_run_start
};

function gekk_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.spawnflags & SPAWNFLAG_GEKK_CHANT) {
        self.spawnflags &= ~SPAWNFLAG_GEKK_CHANT;
        return;
    }

    // Check debounce...

    // Play sound
    context.engine.sound?.(self, 0, 'gek/gk_pain1.wav', 1, 1, 0);

    if (self.waterlevel >= WATER_WAIST) {
         if (!(self.flags & EntityFlags.Swim)) {
              self.flags |= EntityFlags.Swim;
         }
         self.monsterinfo.current_move = gekk_move_pain;
    } else {
        if (random() > 0.5) self.monsterinfo.current_move = gekk_move_pain1;
        else self.monsterinfo.current_move = gekk_move_pain2;
    }
}

// DEATH
const frames_death1: MonsterFrame[] = Array(10).fill({ ai: monster_ai_move, dist: 0 });
frames_death1[5] = { ai: monster_ai_move, dist: -7, think: gekk_shrink };
gekk_move_death1 = {
    firstframe: 210,
    lastframe: 219,
    frames: frames_death1,
    endfunc: gekk_dead
};

const frames_death3: MonsterFrame[] = Array(7).fill({ ai: monster_ai_move, dist: 0 });
frames_death3[5] = { ai: monster_ai_move, dist: -7, think: isgibfest };
gekk_move_death3 = {
    firstframe: 220,
    lastframe: 226,
    frames: frames_death3,
    endfunc: gekk_dead
};

const frames_death4: MonsterFrame[] = Array(35).fill({ ai: monster_ai_move, dist: 0 });
frames_death4[34] = { ai: monster_ai_move, dist: 0, think: gekk_gibfest }; // Last frame check
gekk_move_death4 = {
    firstframe: 227,
    lastframe: 261,
    frames: frames_death4,
    endfunc: gekk_dead
};

const frames_wdeath: MonsterFrame[] = Array(45).fill({ ai: monster_ai_move, dist: 0 });
gekk_move_wdeath = {
    firstframe: 262,
    lastframe: 306,
    frames: frames_wdeath,
    endfunc: gekk_dead
};

function gekk_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod, context: EntitySystem): void {
    // Check gib
    if (self.health <= GIB_HEALTH) {
         throwGibs(context, self.origin, damage);
         return;
    }

    if (self.deadflag === DeadFlag.Dead) return;

    context.engine.sound?.(self, 0, 'gek/gk_deth1.wav', 1, 1, 0);

    self.deadflag = DeadFlag.Dead;
    self.takedamage = true;

    if (self.waterlevel >= WATER_WAIST) {
        gekk_shrink(self);
        self.monsterinfo.current_move = gekk_move_wdeath;
    } else {
        const r = frandom();
        if (r > 0.66) self.monsterinfo.current_move = gekk_move_death1;
        else if (r > 0.33) self.monsterinfo.current_move = gekk_move_death3;
        else self.monsterinfo.current_move = gekk_move_death4;
    }
}

// Spawn
export function SP_monster_gekk(self: Entity, context: SpawnContext): void {
    self.classname = 'monster_gekk';
    self.model = 'models/monsters/gekk/tris.md2';
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;

    self.mins = { x: -18, y: -18, z: -24 };
    self.maxs = { x: 18, y: 18, z: 24 };

    self.health = 125 * context.health_multiplier;
    self.max_health = self.health;
    // self.gib_health = -30;
    self.mass = 300;

    self.pain = (e, o, k, d) => gekk_pain(e, o, k, d, context.entities);
    self.die = (e, i, a, d, p, m) => gekk_die(e, i, a, d, p, m, context.entities);

    self.monsterinfo.stand = gekk_stand;
    self.monsterinfo.walk = (s) => M_SetAnimation(s, gekk_move_walk);
    self.monsterinfo.run = gekk_run_start;
    // self.monsterinfo.dodge = gekk_dodge;
    self.monsterinfo.attack = (s) => gekk_attack(s, context.entities);
    self.monsterinfo.melee = gekk_melee;
    self.monsterinfo.sight = (s, o) => context.entities.sound?.(s, 0, 'gek/gk_sght1.wav', 1, 1, 0);
    self.monsterinfo.search = (s) => gekk_search(s, context.entities);
    self.monsterinfo.idle = (s) => {
         if (s.spawnflags & SPAWNFLAG_GEKK_NOSWIM || s.waterlevel < WATER_WAIST) {
             M_SetAnimation(s, gekk_move_idle);
         } else {
             M_SetAnimation(s, gekk_move_swim_start);
         }
    };
    self.monsterinfo.checkattack = (s) => gekk_checkattack(s, context.entities);

    // self.monsterinfo.scale = MODEL_SCALE;

    context.entities.linkentity(self);

    M_SetAnimation(self, gekk_move_stand);

    self.think = monster_think;
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;

    if (self.spawnflags & SPAWNFLAG_GEKK_CHANT) {
        M_SetAnimation(self, gekk_move_chant);
    }
}

function M_SetAnimation(self: Entity, move: MonsterMove): void {
    self.monsterinfo.current_move = move;
}

function gekk_attack(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    const r = lengthVec3(subtractVec3(self.enemy.origin, self.origin));

    if (self.flags & EntityFlags.Swim) {
        if (self.enemy && self.enemy.waterlevel >= WATER_WAIST && r <= RANGE_NEAR)
            return;

        self.flags &= ~EntityFlags.Swim;
        // self.monsterinfo.aiflags &= ~AI_ALTERNATE_FLY;
        M_SetAnimation(self, gekk_move_leapatk);
        // self.monsterinfo.nextframe = FRAME_leapatk_05; // 144
        self.frame = 144;
    } else {
        if (r >= RANGE_MID) {
            if (frandom() > 0.5) {
                M_SetAnimation(self, gekk_move_spit);
            } else {
                M_SetAnimation(self, gekk_move_run_start);
                // self.monsterinfo.attack_finished = level.time + 2;
            }
        } else if (frandom() > 0.7) {
            M_SetAnimation(self, gekk_move_spit);
        } else {
            if ((self.spawnflags & SPAWNFLAG_GEKK_NOJUMPING) || frandom() > 0.7) {
                M_SetAnimation(self, gekk_move_run_start);
                // self.monsterinfo.attack_finished = level.time + 1.4;
            } else {
                M_SetAnimation(self, gekk_move_leapatk);
            }
        }
    }
}

function gekk_melee(self: Entity): void {
    if (self.waterlevel >= WATER_WAIST) {
        M_SetAnimation(self, gekk_move_attack);
    } else {
        if (frandom() > 0.66) M_SetAnimation(self, gekk_move_attack1);
        else M_SetAnimation(self, gekk_move_attack2);
    }
}

export function registerGekkSpawns(registry: SpawnRegistry): void {
  registry.register('monster_gekk', SP_monster_gekk);
}
