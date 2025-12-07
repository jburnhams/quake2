import {
  angleVectors,
  scaleVec3,
  addVec3,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  MASK_SHOT,
  MASK_PROJECTILE,
  CONTENTS_SLIME,
  CONTENTS_LAVA,
  ServerCommand,
  TempEntity,
  copyVec3,
} from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';
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
  DeadFlag,
} from '../entity.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { GIB_METALLIC, GIB_ORGANIC, throwGibs } from '../gibs.js';
import {
  monster_fire_bullet,
  monster_fire_hit
} from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';
import {
  M_SetAnimation,
  M_AllowSpawn,
  M_ProjectFlashSource,
  M_CheckGib,
  M_ShouldReactToPain,
  M_CheckClearShot
} from './common.js';
import { visible, rangeTo } from '../../ai/perception.js';
import { EntitySystem } from '../system.js';
import { PredictAim } from '../../ai/rogue.js';

const MONSTER_TICK = 0.1;
const MODEL_SCALE = 1.0;
const MELEE_DISTANCE = 80;

// Frame constants
const FRAME_stand01 = 0;
const FRAME_stand17 = 16;
const FRAME_walk01 = 17;
const FRAME_walk12 = 28;
const FRAME_run01 = 29;
const FRAME_run06 = 34;
const FRAME_smash01 = 35;
const FRAME_smash12 = 46;
const FRAME_swingl01 = 47;
const FRAME_swingl09 = 55;
const FRAME_swingr01 = 56;
const FRAME_swingr09 = 64;
const FRAME_magic01 = 65;
const FRAME_magic09 = 73;
const FRAME_magic12 = 76;
const FRAME_pain01 = 77;
const FRAME_pain06 = 82;
const FRAME_death01 = 83;
const FRAME_death11 = 93;

// Sounds
const sound_pain = 'shambler/shurt2.wav';
const sound_idle = 'shambler/sidle.wav';
const sound_die = 'shambler/sdeath.wav';
const sound_windup = 'shambler/sattck1.wav';
const sound_melee1 = 'shambler/melee1.wav';
const sound_melee2 = 'shambler/melee2.wav';
const sound_sight = 'shambler/ssight.wav';
const sound_smack = 'shambler/smack.wav';
const sound_boom = 'shambler/sboom.wav';

const SPAWNFLAG_SHAMBLER_PRECISE = 1;

// Forward declarations
let shambler_move_stand: MonsterMove;
let shambler_move_walk: MonsterMove;
let shambler_move_run: MonsterMove;
let shambler_move_pain: MonsterMove;
let shambler_attack_magic: MonsterMove;
let shambler_attack_smash: MonsterMove;
let shambler_attack_swingl: MonsterMove;
let shambler_attack_swingr: MonsterMove;
let shambler_move_death: MonsterMove;

// AI Wrappers
function shambler_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
  ai_stand(self, MONSTER_TICK, context);
}

function shambler_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function shambler_ai_run(self: Entity, dist: number, context: EntitySystem): void {
  ai_run(self, dist, MONSTER_TICK, context);
}

function shambler_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function shambler_ai_move(self: Entity, dist: number, context: EntitySystem): void {
  ai_move(self, dist);
}

// Misc
function shambler_sight(self: Entity, other: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, sound_sight, 1, 1, 0);
}

function shambler_idle(self: Entity, context: EntitySystem): void {
  context.engine.sound?.(self, 0, sound_idle, 1, 0.5, 0);
}

function shambler_maybe_idle(self: Entity, context: EntitySystem): void {
  if (context.rng.frandom() > 0.8) {
    context.engine.sound?.(self, 0, sound_idle, 1, 0.5, 0);
  }
}

// Lightning logic
const lightning_left_hand: Vec3[] = [
    { x: 44, y: 36, z: 25 },
    { x: 10, y: 44, z: 57 },
    { x: -1, y: 40, z: 70 },
    { x: -10, y: 34, z: 75 },
    { x: 7.4, y: 24, z: 89 }
];

const lightning_right_hand: Vec3[] = [
    { x: 28, y: -38, z: 25 },
    { x: 31, y: -7, z: 70 },
    { x: 20, y: 0, z: 80 },
    { x: 16, y: 1.2, z: 81 },
    { x: 27, y: -11, z: 83 }
];

function shambler_lightning_update(self: Entity, context: EntitySystem): void {
    const lightning = self.beam;
    if (!lightning || !lightning.inUse) return;

    const frameIdx = self.frame - FRAME_magic01;
    if (frameIdx >= lightning_left_hand.length) {
        context.free(lightning);
        self.beam = null;
        return;
    }

    const { forward, right } = angleVectors(self.angles);
    lightning.origin = M_ProjectFlashSource(self, lightning_left_hand[frameIdx], forward, right);
    lightning.old_origin = M_ProjectFlashSource(self, lightning_right_hand[frameIdx], forward, right);
    context.linkentity(lightning);
}

function shambler_windup(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, sound_windup, 1, 1, 0);

    const lightning = context.spawn();
    self.beam = lightning;
    lightning.modelindex = context.modelIndex('models/proj/lightning/tris.md2');
    lightning.renderfx = 4; // RF_BEAM

    lightning.owner = self;
    lightning.classname = 'shambler_lightning';
    shambler_lightning_update(self, context);
}


// Stand
function shambler_stand(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, shambler_move_stand, context);
}

shambler_move_stand = {
    firstframe: FRAME_stand01,
    lastframe: FRAME_stand17,
    frames: Array(17).fill({ ai: shambler_ai_stand, dist: 0 }),
    endfunc: null
};

// Walk
function shambler_walk(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, shambler_move_walk, context);
}

shambler_move_walk = {
    firstframe: FRAME_walk01,
    lastframe: FRAME_walk12,
    frames: [
        { ai: shambler_ai_walk, dist: 10 },
        { ai: shambler_ai_walk, dist: 9 },
        { ai: shambler_ai_walk, dist: 9 },
        { ai: shambler_ai_walk, dist: 5 },
        { ai: shambler_ai_walk, dist: 6 },
        { ai: shambler_ai_walk, dist: 12 },
        { ai: shambler_ai_walk, dist: 8 },
        { ai: shambler_ai_walk, dist: 3 },
        { ai: shambler_ai_walk, dist: 13 },
        { ai: shambler_ai_walk, dist: 9 },
        { ai: shambler_ai_walk, dist: 7, think: shambler_maybe_idle },
        { ai: shambler_ai_walk, dist: 5 },
    ],
    endfunc: null
};

// Run
function shambler_run(self: Entity, context: EntitySystem): void {
    // AI_BRUTAL check ignored for now or can use AIFlags.
    if (self.monsterinfo.aiflags & 64) { // AI_STAND_GROUND = 64
        M_SetAnimation(self, shambler_move_stand, context);
        return;
    }
    M_SetAnimation(self, shambler_move_run, context);
}

shambler_move_run = {
    firstframe: FRAME_run01,
    lastframe: FRAME_run06,
    frames: [
        { ai: shambler_ai_run, dist: 20 },
        { ai: shambler_ai_run, dist: 24 },
        { ai: shambler_ai_run, dist: 20 },
        { ai: shambler_ai_run, dist: 20 },
        { ai: shambler_ai_run, dist: 24 },
        { ai: shambler_ai_run, dist: 20, think: shambler_maybe_idle },
    ],
    endfunc: null
};

// Pain
shambler_move_pain = {
    firstframe: FRAME_pain01,
    lastframe: FRAME_pain06,
    frames: Array(6).fill({ ai: shambler_ai_move, dist: 0 }),
    endfunc: shambler_run
};

function shambler_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (context.timeSeconds < self.timestamp) return;

    self.timestamp = context.timeSeconds + 0.001;
    context.engine.sound?.(self, 0, sound_pain, 1, 1, 0);

    // DamageMod check needs logic or argument passing.
    // If not MOD_CHAINFIST and damage <= 30 ...
    if (damage <= 30 && context.rng.frandom() > 0.2) return;

    // Check attacking frames to avoid interruption
    if (self.frame >= FRAME_smash01 && self.frame <= FRAME_smash12) return;
    if (self.frame >= FRAME_swingl01 && self.frame <= FRAME_swingl09) return;
    if (self.frame >= FRAME_swingr01 && self.frame <= FRAME_swingr09) return;

    if (!M_ShouldReactToPain(self, context)) return;

    if (context.timeSeconds < self.pain_debounce_time) return;

    self.pain_debounce_time = context.timeSeconds + 2;
    M_SetAnimation(self, shambler_move_pain, context);
}

// Attacks

function ShamblerSaveLoc(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    self.pos1 = { ...self.enemy.origin };
    self.pos1 = { ...self.pos1, z: self.pos1.z + (self.enemy.viewheight || 0) };
    self.monsterinfo.nextframe = FRAME_magic09;

    context.engine.sound?.(self, 0, sound_boom, 1, 1, 0);
    shambler_lightning_update(self, context);
}

function FindShamblerOffset(self: Entity, context: EntitySystem): Vec3 {
    const offset: { x: number; y: number; z: number } = { x: 0, y: 0, z: 48 };
    for (let i = 0; i < 8; i++) {
        if (M_CheckClearShot(self, offset, context)) {
            return offset;
        }
        offset.z -= 4;
    }
    return { x: 0, y: 0, z: 48 };
}

function ShamblerCastLightning(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const offset = FindShamblerOffset(self, context);
    const { forward, right } = angleVectors(self.angles);
    const start = M_ProjectFlashSource(self, offset, forward, right);

    const precise = (self.spawnflags & SPAWNFLAG_SHAMBLER_PRECISE) !== 0;
    const { aimdir } = PredictAim(context, self, self.enemy, start, 0, false, precise ? 0 : 0.1);

    const end = addVec3(start, scaleVec3(aimdir, 8192));
    const tr = context.trace(start, null, null, end, self, MASK_PROJECTILE | CONTENTS_SLIME | CONTENTS_LAVA);

    context.multicast(start, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.LIGHTNING, self, 0, start, tr.endpos);

    // damage 15 * random(8, 12) ~ 150 average? No, fire_bullet damage is per shot?
    // C: fire_bullet(self, start, dir, irandom(8, 12), 15, 0, 0, MOD_TESLA);
    // count = 8-12, damage = 15.
    const count = 8 + context.rng.irandom(0, 4);
    monster_fire_bullet(self, start, aimdir, 15, 15, 0, 0, count, context, DamageMod.TESLA);
}

shambler_attack_magic = {
    firstframe: FRAME_magic01,
    lastframe: FRAME_magic12,
    frames: [
        { ai: shambler_ai_charge, dist: 0, think: shambler_windup },
        { ai: shambler_ai_charge, dist: 0, think: shambler_lightning_update },
        { ai: shambler_ai_charge, dist: 0, think: shambler_lightning_update },
        { ai: shambler_ai_move, dist: 0, think: shambler_lightning_update },
        { ai: shambler_ai_move, dist: 0, think: shambler_lightning_update },
        { ai: shambler_ai_move, dist: 0, think: ShamblerSaveLoc },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_charge, dist: 0 },
        { ai: shambler_ai_move, dist: 0, think: ShamblerCastLightning },
        { ai: shambler_ai_move, dist: 0, think: ShamblerCastLightning },
        { ai: shambler_ai_move, dist: 0, think: ShamblerCastLightning },
        { ai: shambler_ai_move, dist: 0 },
    ],
    endfunc: shambler_run
};

function shambler_attack(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, shambler_attack_magic, context);
}

// Melee
function shambler_melee1(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, sound_melee1, 1, 1, 0);
}

function shambler_melee2(self: Entity, context: EntitySystem): void {
    context.engine.sound?.(self, 0, sound_melee2, 1, 1, 0);
}

function sham_smash10(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    shambler_ai_charge(self, 0, context);

    const aim = { x: MELEE_DISTANCE, y: self.mins.x, z: -4 };
    // damage: irandom(110, 120), kick: 120
    const damage = 110 + context.rng.frandom() * 10;
    if (monster_fire_hit(self, aim, damage, 120, context)) {
        context.engine.sound?.(self, 0, sound_smack, 1, 1, 0);
    }
}

function ShamClaw(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;
    shambler_ai_charge(self, 10, context);

    const aim = { x: MELEE_DISTANCE, y: self.mins.x, z: -4 };
    // damage: irandom(70, 80), kick: 80
    const damage = 70 + context.rng.frandom() * 10;
    if (monster_fire_hit(self, aim, damage, 80, context)) {
        context.engine.sound?.(self, 0, sound_smack, 1, 1, 0);
    }
}

shambler_attack_smash = {
    firstframe: FRAME_smash01,
    lastframe: FRAME_smash12,
    frames: [
        { ai: shambler_ai_charge, dist: 2, think: shambler_melee1 },
        { ai: shambler_ai_charge, dist: 6 },
        { ai: shambler_ai_charge, dist: 6 },
        { ai: shambler_ai_charge, dist: 5 },
        { ai: shambler_ai_charge, dist: 4 },
        { ai: shambler_ai_charge, dist: 1 },
        { ai: shambler_ai_charge, dist: 0 },
        { ai: shambler_ai_charge, dist: 0 },
        { ai: shambler_ai_charge, dist: 0 },
        { ai: shambler_ai_charge, dist: 0, think: sham_smash10 },
        { ai: shambler_ai_charge, dist: 5 },
        { ai: shambler_ai_charge, dist: 4 },
    ],
    endfunc: shambler_run
};

function sham_swingl9(self: Entity, context: EntitySystem): void {
    shambler_ai_charge(self, 8, context);
    if (context.rng.frandom() < 0.5 && self.enemy && rangeTo(self, self.enemy) < MELEE_DISTANCE) {
        M_SetAnimation(self, shambler_attack_swingr, context);
    }
}

function sham_swingr9(self: Entity, context: EntitySystem): void {
    shambler_ai_charge(self, 1, context);
    shambler_ai_charge(self, 10, context); // Original calls ai_charge twice
    if (context.rng.frandom() < 0.5 && self.enemy && rangeTo(self, self.enemy) < MELEE_DISTANCE) {
        M_SetAnimation(self, shambler_attack_swingl, context);
    }
}


shambler_attack_swingl = {
    firstframe: FRAME_swingl01,
    lastframe: FRAME_swingl09,
    frames: [
        { ai: shambler_ai_charge, dist: 5, think: shambler_melee1 },
        { ai: shambler_ai_charge, dist: 3 },
        { ai: shambler_ai_charge, dist: 7 },
        { ai: shambler_ai_charge, dist: 3 },
        { ai: shambler_ai_charge, dist: 7 },
        { ai: shambler_ai_charge, dist: 9 },
        { ai: shambler_ai_charge, dist: 5, think: ShamClaw },
        { ai: shambler_ai_charge, dist: 4 },
        { ai: shambler_ai_charge, dist: 8, think: sham_swingl9 },
    ],
    endfunc: shambler_run
};

shambler_attack_swingr = {
    firstframe: FRAME_swingr01,
    lastframe: FRAME_swingr09,
    frames: [
        { ai: shambler_ai_charge, dist: 1, think: shambler_melee2 },
        { ai: shambler_ai_charge, dist: 8 },
        { ai: shambler_ai_charge, dist: 14 },
        { ai: shambler_ai_charge, dist: 7 },
        { ai: shambler_ai_charge, dist: 3 },
        { ai: shambler_ai_charge, dist: 6 },
        { ai: shambler_ai_charge, dist: 6, think: ShamClaw },
        { ai: shambler_ai_charge, dist: 3 },
        { ai: shambler_ai_charge, dist: 8, think: sham_swingr9 },
    ],
    endfunc: shambler_run
};

function shambler_melee(self: Entity, context: EntitySystem): void {
    const chance = context.rng.frandom();
    if (chance > 0.6 || self.health === 600) {
        M_SetAnimation(self, shambler_attack_smash, context);
    } else if (chance > 0.3) {
        M_SetAnimation(self, shambler_attack_swingl, context);
    } else {
        M_SetAnimation(self, shambler_attack_swingr, context);
    }
}

// Death
function shambler_shrink(self: Entity, context: EntitySystem): void {
    self.maxs = { ...self.maxs, z: 0 };
    // self.svflags |= SVF_DEADMONSTER;
    context.linkentity(self);
}

function shambler_dead(self: Entity, context: EntitySystem): void {
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 0 };
    self.nextthink = -1;
    self.solid = Solid.Not;
}

shambler_move_death = {
    firstframe: FRAME_death01,
    lastframe: FRAME_death11,
    frames: [
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0, think: shambler_shrink },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
        { ai: shambler_ai_move, dist: 0 },
    ],
    endfunc: shambler_dead
};

function shambler_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, context: EntitySystem): void {
    if (self.beam) {
        context.free(self.beam);
        self.beam = null;
    }

    if (M_CheckGib(self, damage)) {
        context.engine.sound?.(self, 0, 'misc/udeath.wav', 1, 1, 0);
        throwGibs(context, self.origin, [
             { count: 1, model: 'models/objects/gibs/sm_meat/tris.md2', flags: GIB_ORGANIC },
             { count: 1, model: 'models/objects/gibs/chest/tris.md2', flags: GIB_ORGANIC },
             { count: 1, model: 'models/objects/gibs/head2/tris.md2', flags: GIB_ORGANIC } // GIB_HEAD flag assumed handled or ignored for now
        ]);
        self.deadflag = DeadFlag.Dead;
        return;
    }

    if (self.deadflag) return;

    context.engine.sound?.(self, 0, sound_die, 1, 1, 0);
    self.deadflag = DeadFlag.Dead;
    self.takedamage = true;

    M_SetAnimation(self, shambler_move_death, context);
}

// Spawn
export function SP_monster_shambler(self: Entity, context: SpawnContext): void {
    if (!M_AllowSpawn(self, context.entities)) {
        context.entities.free(self);
        return;
    }

    self.classname = 'monster_shambler';
    self.model = 'models/monsters/shambler/tris.md2';
    self.modelindex = context.entities.modelIndex('models/monsters/shambler/tris.md2');
    self.mins = { x: -32, y: -32, z: -24 };
    self.maxs = { x: 32, y: 32, z: 64 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;

    // Precache
    context.entities.modelIndex('models/proj/lightning/tris.md2');

    self.health = 600 * context.health_multiplier;
    self.max_health = self.health;
    self.mass = 500;

    self.pain = (s, o, k, d) => shambler_pain(s, o, k, d, context.entities);
    self.die = (s, i, a, d, p) => shambler_die(s, i, a, d, p, context.entities);

    self.monsterinfo.stand = (s) => shambler_stand(s, context.entities);
    self.monsterinfo.walk = (s) => shambler_walk(s, context.entities);
    self.monsterinfo.run = (s) => shambler_run(s, context.entities);
    self.monsterinfo.attack = (s) => shambler_attack(s, context.entities);
    self.monsterinfo.melee = (s) => shambler_melee(s, context.entities);
    self.monsterinfo.sight = (s, o) => shambler_sight(s, o, context.entities);
    self.monsterinfo.idle = (s) => shambler_idle(s, context.entities);
    self.monsterinfo.setskin = (s) => {}; // shambler_setskin not fully implemented yet

    if (self.spawnflags & SPAWNFLAG_SHAMBLER_PRECISE) {
        // self.monsterinfo.aiflags |= AI_IGNORE_SHOTS; // Not in AIFlags enum yet?
    }

    context.entities.linkentity(self);

    M_SetAnimation(self, shambler_move_stand, context.entities);
    self.monsterinfo.scale = MODEL_SCALE;

    self.think = monster_think;
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;
}

export function registerShamblerSpawns(registry: SpawnRegistry): void {
    registry.register('monster_shambler', SP_monster_shambler);
}
