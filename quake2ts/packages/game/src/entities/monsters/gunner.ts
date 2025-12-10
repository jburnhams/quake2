import { angleVectors, normalizeVec3, subtractVec3, Vec3, vectorToAngles } from '@quake2ts/shared';
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
    EntityFlags,
    MonsterFrame,
    MonsterMove,
    MoveType,
    Solid,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { monster_fire_bullet } from './attack.js';
import { createGrenade } from '../projectiles.js';
import { GIB_METALLIC, throwGibs } from '../gibs.js';
import type { EntitySystem } from '../system.js';
import { AIFlags } from '../../ai/constants.js';
import { visible } from '../../ai/perception.js';

const MONSTER_TICK = 0.1;

// Constants extracted from m_gunner.c
const GUNNER_HEALTH = 175;
const GUNNER_MASS = 200;
const GUNNER_PAIN_DEBOUNCE = 3;
const GUNNER_BULLET_DAMAGE = 3;
const GUNNER_BULLET_KICK = 4;
const GUNNER_BULLET_HSPREAD = 300;
const GUNNER_BULLET_VSPREAD = 500;
const GUNNER_GRENADE_DAMAGE = 50;
const GUNNER_GRENADE_SPEED = 600;
const GUNNER_JUMP_SPEED_FWD = 600;
const GUNNER_JUMP_SPEED_UP = 270;
const GUNNER_MIN_JUMP_DIST = 256;
const GUNNER_ATTACK_FINISHED_DELAY = 3.0;

// Wrappers for AI functions to match AIAction signature (self, dist)
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

// Forward declarations for moves
let stand_move: MonsterMove;
let fidget_move: MonsterMove; // Fidget
let walk_move: MonsterMove;
let run_move: MonsterMove;
let runandshoot_move: MonsterMove; // Run and Shoot
let attack_chain_move: MonsterMove;
let attack_grenade_move: MonsterMove;
let fire_chain_move: MonsterMove;
let endfire_chain_move: MonsterMove;
let pain1_move: MonsterMove; // Pain 1
let pain2_move: MonsterMove; // Pain 2
let pain3_move: MonsterMove; // Pain 3
let death_move: MonsterMove;
let duck_move: MonsterMove; // Duck
let jump_move: MonsterMove; // Jump

// Gunner specific functions
function gunner_idlesound(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'gunner/gunidle1.wav', 1, 1, 0);
}

function gunner_stand(self: Entity): void {
    self.monsterinfo.current_move = stand_move;
}

function gunner_fidget(self: Entity, context: EntitySystem): void {
    if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        return;
    }
    if (context.rng.frandom() <= 0.05) {
        self.monsterinfo.current_move = fidget_move;
    }
}

function gunner_walk(self: Entity): void {
    self.monsterinfo.current_move = walk_move;
}

function gunner_run(self: Entity): void {
    if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        self.monsterinfo.current_move = stand_move;
    } else {
        self.monsterinfo.current_move = run_move;
    }
}

function gunner_runandshoot(self: Entity): void {
    self.monsterinfo.current_move = runandshoot_move;
}

function gunner_attack(self: Entity, context: EntitySystem): void {
    if (context.rng.frandom() > 0.5) {
        self.monsterinfo.current_move = attack_chain_move;
    } else {
        self.monsterinfo.current_move = attack_grenade_move;
    }
}

function gunner_opengun(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'gunner/gunatck1.wav', 1, 1, 0);
}

function gunner_fire_chain(self: Entity, context: any): void {
    self.monsterinfo.current_move = fire_chain_move;
}

function gunner_refire_chain(self: Entity, context: any): void {
    if (self.enemy && self.enemy.health > 0) {
        // Correct behavior: don't keep firing if blocked
        if (visible(self, self.enemy, context.trace)) {
            if (context.rng.frandom() <= 0.5) {
                self.monsterinfo.current_move = fire_chain_move;
                return;
            }
        }
    }
    self.monsterinfo.current_move = endfire_chain_move;
}

function gunner_fire_bullet_logic(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight - 8,
    };

    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    context.engine.sound?.(self, 0, 'gunner/gunatck2.wav', 1, 1, 0);

    monster_fire_bullet(self, start, forward, GUNNER_BULLET_DAMAGE, GUNNER_BULLET_KICK, GUNNER_BULLET_HSPREAD, GUNNER_BULLET_VSPREAD, 0, context, DamageMod.CHAINGUN);
}

function gunner_fire_grenade(self: Entity, context: any): void {
    if (!self.enemy) return;

    const start: Vec3 = {
        x: self.origin.x,
        y: self.origin.y,
        z: self.origin.z + self.viewheight,
    };

    const forward = normalizeVec3(subtractVec3(self.enemy.origin, start));

    context.engine.sound?.(self, 0, 'gunner/gunatck3.wav', 1, 1, 0);

    createGrenade(context as EntitySystem, self, start, forward, GUNNER_GRENADE_DAMAGE, GUNNER_GRENADE_SPEED);
}

function gunner_pain(self: Entity, context: any): void {
    if (self.health < (self.max_health / 2)) {
         // self.s.skinnum = 1;
    }

    if (self.pain_debounce_time && context.timeSeconds < self.pain_debounce_time) return;
    self.pain_debounce_time = context.timeSeconds + GUNNER_PAIN_DEBOUNCE;

    if (!M_ShouldReactToPain(self, context)) {
        return;
    }

    if (context.rng.frandom() < 0.5) {
        context.engine.sound?.(self, 0, 'gunner/gunpain1.wav', 1, 1, 0);
    } else {
        context.engine.sound?.(self, 0, 'gunner/gunpain2.wav', 1, 1, 0);
    }

    const r = context.rng.frandom();
    if (r < 0.33) {
        self.monsterinfo.current_move = pain3_move;
    } else if (r < 0.66) {
        self.monsterinfo.current_move = pain2_move;
    } else {
        self.monsterinfo.current_move = pain1_move;
    }
}

function gunner_die(self: Entity, context: any): void {
    context.engine.sound?.(self, 0, 'gunner/death1.wav', 1, 1, 0);
    self.monsterinfo.current_move = death_move;
}

function gunner_duck_down(self: Entity, context: any): void {
    if (self.monsterinfo.aiflags & AIFlags.Ducked) return;
    self.monsterinfo.aiflags |= AIFlags.Ducked;

    if (context.rng.frandom() > 0.5) {
         gunner_fire_grenade(self, context);
    }

    self.maxs = { ...self.maxs, z: self.maxs.z - 32 };
    self.takedamage = true;
    self.monsterinfo.pausetime = context.timeSeconds + 1;
}

function gunner_duck_hold(self: Entity, context: any): void {
    if (context.timeSeconds >= self.monsterinfo.pausetime) {
        self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
    } else {
        self.monsterinfo.aiflags |= AIFlags.HoldFrame;
    }
}

function gunner_duck_up(self: Entity, context: any): void {
    self.monsterinfo.aiflags &= ~AIFlags.Ducked;
    self.maxs = { ...self.maxs, z: self.maxs.z + 32 };
    self.takedamage = true;
}

function gunner_dodge(self: Entity, attacker: Entity, eta: number, context: any): void {
    if (context.rng.frandom() > 0.25) return;

    if (!self.enemy) self.enemy = attacker;

    self.monsterinfo.current_move = duck_move;
}

// Jump
function gunner_jump_takeoff(self: Entity, context: any): void {
    if (!self.enemy) return;

    const diff = subtractVec3(self.enemy.origin, self.origin);

    const forward = normalizeVec3({x: diff.x, y: diff.y, z: 0});
    const angles = vectorToAngles(forward);
    self.angles = { x: self.angles.x, y: angles.y, z: self.angles.z };

    const origin = { ...self.origin };
    origin.z += 1;
    self.origin = origin;

    self.velocity = {
      x: forward.x * GUNNER_JUMP_SPEED_FWD,
      y: forward.y * GUNNER_JUMP_SPEED_FWD,
      z: GUNNER_JUMP_SPEED_UP
    };
    self.groundentity = null;
    self.monsterinfo.aiflags |= AIFlags.Ducked;
    self.monsterinfo.attack_finished = context.timeSeconds + GUNNER_ATTACK_FINISHED_DELAY;
  }

  function gunner_check_landing(self: Entity, context: any): void {
    if (self.groundentity) {
      context.engine.sound?.(self, 0, 'mutant/thud1.wav', 1, 1, 0);
      self.monsterinfo.attack_finished = 0;
      self.monsterinfo.aiflags &= ~AIFlags.Ducked;
      // Transitions to run via endfunc
      return;
    }

    if (context.timeSeconds > (self.monsterinfo.attack_finished || 0)) {
      self.monsterinfo.nextframe = 209 + 5;
    } else {
      self.monsterinfo.nextframe = 209 + 3;
    }
  }

  function gunner_jump(self: Entity, context: any): void {
     if (self.spawnflags & 16) return; // NO JUMPING
     if (!self.enemy) return;
     if (!self.groundentity) return;

     const dist = Math.sqrt(
         Math.pow(self.enemy.origin.x - self.origin.x, 2) +
         Math.pow(self.enemy.origin.y - self.origin.y, 2)
     );

     // Jump if far away and random chance
     // Match rerelease logic if possible, or reasonable approx
     if (dist > GUNNER_MIN_JUMP_DIST && context.rng.frandom() < 0.02) {
         context.engine.sound?.(self, 0, 'gunner/gunatck3.wav', 1, 1, 0);
         self.monsterinfo.current_move = jump_move;
     }
  }

// --- Frames ---

// Stand
const stand_frames: MonsterFrame[] = Array.from({ length: 30 }, (_, i) => ({
    ai: monster_ai_stand,
    dist: 0,
    think: i === 29 ? gunner_fidget : null,
}));
stand_move = {
    firstframe: 0,
    lastframe: 29,
    frames: stand_frames,
    endfunc: null,
};

// Fidget (30-69)
const fidget_frames: MonsterFrame[] = Array.from({ length: 40 }, (_, i) => ({
    ai: monster_ai_stand,
    dist: 0,
    think: i === 7 ? gunner_idlesound : null
}));
fidget_move = {
    firstframe: 30,
    lastframe: 69,
    frames: fidget_frames,
    endfunc: gunner_stand
};

// Walk (70-88) - corrected frame range from source
const walk_dists = [0, 3, 4, 5, 7, 2, 6, 4, 2, 7, 5, 7, 4]; // 13 frames
const walk_frames: MonsterFrame[] = walk_dists.map(d => ({
    ai: monster_ai_walk,
    dist: d,
}));
walk_move = {
    firstframe: 76,
    lastframe: 88,
    frames: walk_frames,
    endfunc: null,
};


// Run (94-101) - Source: FRAME_run01 to FRAME_run08
// Inject gunner_jump check into run frames (e.g. every 4 frames or so)
const run_dists = [26, 9, 9, 9, 15, 10, 13, 6];
const run_frames: MonsterFrame[] = run_dists.map((d, i) => ({
    ai: monster_ai_run,
    dist: d,
    think: (i % 4 === 0) ? gunner_jump : null // Check jump periodically
}));
run_move = {
    firstframe: 94,
    lastframe: 101,
    frames: run_frames,
    endfunc: null,
};

// Run and Shoot (102-107) - Source: FRAME_runs01 to FRAME_runs06
const runshoot_dists = [32, 15, 10, 18, 8, 20];
const runshoot_frames: MonsterFrame[] = runshoot_dists.map(d => ({
    ai: monster_ai_run,
    dist: d,
}));
runandshoot_move = {
    firstframe: 102,
    lastframe: 107,
    frames: runshoot_frames,
    endfunc: null,
};

// Attack Grenade (108-128) - Source: FRAME_attak101 to FRAME_attak121
const attack_grenade_frames: MonsterFrame[] = Array.from({ length: 21 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: [4, 7, 10, 13].includes(i) ? gunner_fire_grenade : null,
}));
attack_grenade_move = {
    firstframe: 108,
    lastframe: 128,
    frames: attack_grenade_frames,
    endfunc: gunner_run,
};

// Attack Chain (137-143) - Source: FRAME_attak209 to FRAME_attak215
const attack_chain_frames: MonsterFrame[] = Array.from({ length: 7 }, (_, i) => ({
    ai: monster_ai_charge,
    dist: 0,
    think: i === 0 ? gunner_opengun : null,
}));
attack_chain_move = {
    firstframe: 137,
    lastframe: 143,
    frames: attack_chain_frames,
    endfunc: gunner_fire_chain,
};

// Fire Chain (144-151) - Source: FRAME_attak216 to FRAME_attak223
const fire_chain_frames: MonsterFrame[] = Array.from({ length: 8 }, () => ({
    ai: monster_ai_charge,
    dist: 0,
    think: gunner_fire_bullet_logic,
}));
fire_chain_move = {
    firstframe: 144,
    lastframe: 151,
    frames: fire_chain_frames,
    endfunc: gunner_refire_chain,
};

// End Fire Chain (152-158) - Source: FRAME_attak224 to FRAME_attak230
const endfire_chain_frames: MonsterFrame[] = Array.from({ length: 7 }, () => ({
    ai: monster_ai_charge,
    dist: 0,
}));
endfire_chain_move = {
    firstframe: 152,
    lastframe: 158,
    frames: endfire_chain_frames,
    endfunc: gunner_run,
};

// Pain 1 (159-176) - Source: FRAME_pain101 to FRAME_pain118
const pain1_dists = [2, 0, -5, 3, -1, 0, 0, 0, 0, 1, 1, 2, 1, 0, -2, -2, 0, 0];
const pain1_frames: MonsterFrame[] = pain1_dists.map(d => ({
    ai: monster_ai_move,
    dist: d
}));
pain1_move = {
    firstframe: 159,
    lastframe: 176,
    frames: pain1_frames,
    endfunc: gunner_run,
};

// Pain 2 (177-184) - Source: FRAME_pain201 to FRAME_pain208
const pain2_dists = [-2, 11, 6, 2, -1, -7, -2, -7];
const pain2_frames: MonsterFrame[] = pain2_dists.map(d => ({
    ai: monster_ai_move,
    dist: d
}));
pain2_move = {
    firstframe: 177,
    lastframe: 184,
    frames: pain2_frames,
    endfunc: gunner_run,
};

// Pain 3 (185-189) - Source: FRAME_pain301 to FRAME_pain305
const pain3_dists = [-3, 1, 1, 0, 1];
const pain3_frames: MonsterFrame[] = pain3_dists.map(d => ({
    ai: monster_ai_move,
    dist: d
}));
pain3_move = {
    firstframe: 185,
    lastframe: 189,
    frames: pain3_frames,
    endfunc: gunner_run,
};

// Death (190-200) - Source: FRAME_death01 to FRAME_death11
const death_dists = [0, 0, 0, -7, -3, -5, 8, 6, 0, 0, 0];
const death_frames: MonsterFrame[] = death_dists.map(d => ({
    ai: monster_ai_move,
    dist: d,
}));

function gunner_dead(self: Entity): void {
    self.monsterinfo.nextframe = death_move.lastframe;
    self.nextthink = -1;
    self.solid = Solid.Not;
}

death_move = {
    firstframe: 190,
    lastframe: 200,
    frames: death_frames,
    endfunc: gunner_dead,
};

// Duck (201-208) - Source: FRAME_duck01 to FRAME_duck08
const duck_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 1, think: gunner_duck_down },
    { ai: monster_ai_move, dist: 1 },
    { ai: monster_ai_move, dist: 1, think: gunner_duck_hold },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: -1 },
    { ai: monster_ai_move, dist: -1 },
    { ai: monster_ai_move, dist: 0, think: gunner_duck_up },
    { ai: monster_ai_move, dist: -1 },
];
duck_move = {
    firstframe: 201,
    lastframe: 208,
    frames: duck_frames,
    endfunc: gunner_run,
};

// Jump (Assuming frames 209-216, 8 frames)
const jump_frames: MonsterFrame[] = [
    { ai: monster_ai_move, dist: 0, think: gunner_jump_takeoff },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0, think: gunner_check_landing },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 },
    { ai: monster_ai_move, dist: 0 }
];

jump_move = {
    firstframe: 209,
    lastframe: 216,
    frames: jump_frames,
    endfunc: gunner_run
};

export function SP_monster_gunner(self: Entity, context: SpawnContext): void {
    self.model = 'models/monsters/gunner/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.health = GUNNER_HEALTH * context.health_multiplier;
    self.max_health = self.health;
    self.mass = GUNNER_MASS;
    self.takedamage = true;

    self.pain = (self, other, kick, damage) => {
        gunner_pain(self, context.entities);
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        self.deadflag = DeadFlag.Dead;
        self.solid = Solid.Not;

        if (self.health < -40) {
            context.entities.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
            throwGibs(context.entities, self.origin, damage, GIB_METALLIC);
            context.entities.free(self);
            return;
        }

        gunner_die(self, context.entities);
    };

    self.monsterinfo.stand = gunner_stand;
    self.monsterinfo.walk = gunner_walk;
    self.monsterinfo.run = gunner_run;
    self.monsterinfo.attack = (ent) => gunner_attack(ent, context.entities);
    self.monsterinfo.dodge = (self, attacker, eta) => gunner_dodge(self, attacker, eta, context.entities);
    self.monsterinfo.sight = (self, other) => {
        context.entities.sound?.(self, 0, 'gunner/sight1.wav', 1, 1, 0);
    };

    self.think = monster_think;

    gunner_stand(self);
    self.nextthink = self.timestamp + MONSTER_TICK;
}

export function registerGunnerSpawns(registry: SpawnRegistry): void {
    registry.register('monster_gunner', SP_monster_gunner);
}
