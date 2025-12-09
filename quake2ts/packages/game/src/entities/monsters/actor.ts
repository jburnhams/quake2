import { Entity, MonsterFrame, MonsterMove, MoveType, Solid, DeadFlag, EntityFlags } from '../entity.js';
import { monster_think, ai_stand, ai_walk, ai_run, ai_move, ai_turn, ai_charge, AIFlags } from '../../ai/index.js';
import { throwGibs } from '../gibs.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { DamageMod } from '../../combat/damageMods.js';
import { monster_fire_bullet } from './attack.js';
import { angleVectors, vectorToYaw as vectoyaw, SoundChannel, ATTN_NORM, ATTN_IDLE, ATTN_STATIC, ATTN_NONE } from '@quake2ts/shared';
import { Vec3, subtractVec3 as subVec3, normalizeVec3, scaleVec3, addVec3, copyVec3, lengthVec3 } from '@quake2ts/shared';
import { setMovedir } from '../utils.js';

type MutableVec3 = { -readonly [P in keyof Vec3]: Vec3[P] };

// GIB_HEAD is not exported from gibs.js, assuming it handles head automatically or doesn't use it in current port.
// monster_start_go is not available, using manual startup.

const MONSTER_TICK = 0.1;

const MZ2_ACTOR_MACHINEGUN_1 = 0; // Placeholder, assuming it maps to some damage/offset config

const actor_names = [
    "Hellrot",
    "Tokay",
    "Killme",
    "Disruptor",
    "Adrianator",
    "Rambear",
    "Titus",
    "Bitterman"
];

// Sounds
const sound_pain1 = 'player/male/pain100.wav';
const sound_pain2 = 'player/male/pain75.wav';
const sound_pain3 = 'player/male/pain50.wav';
const sound_die1 = 'player/male/death1.wav';
const sound_die2 = 'player/male/death2.wav';
const sound_gib = 'misc/udeath.wav';


// Frames
const FRAME_stand101 = 0;
const FRAME_stand140 = 39;

const FRAME_walk01 = 40;
const FRAME_walk08 = 47;

const FRAME_run02 = 48;
const FRAME_run07 = 53;

const FRAME_pain101 = 54;
const FRAME_pain103 = 56;

const FRAME_pain201 = 57;
const FRAME_pain203 = 59;

const FRAME_pain301 = 60;
const FRAME_pain303 = 62;

const FRAME_flip01 = 63;
const FRAME_flip14 = 76;

const FRAME_taunt01 = 77;
const FRAME_taunt17 = 93;

const FRAME_death101 = 94;
const FRAME_death107 = 100;

const FRAME_death201 = 101;
const FRAME_death213 = 113;

const FRAME_attak01 = 114;
const FRAME_attak04 = 117;


// Forward declarations
let actor_move_stand: MonsterMove;
let actor_move_walk: MonsterMove;
let actor_move_run: MonsterMove;
let actor_move_pain1: MonsterMove;
let actor_move_pain2: MonsterMove;
let actor_move_pain3: MonsterMove;
let actor_move_flipoff: MonsterMove;
let actor_move_taunt: MonsterMove;
let actor_move_death1: MonsterMove;
let actor_move_death2: MonsterMove;
let actor_move_attack: MonsterMove;

function m(ai: any, dist: number = 0, think?: (self: Entity, context: any) => void): MonsterFrame {
    return { ai: (s, d, c) => {
        if (think) think(s, c);
        ai(s, dist, MONSTER_TICK, c);
    }, dist };
}

function actor_stand(self: Entity, context: any) {
    self.monsterinfo.current_move = actor_move_stand;

    // randomize on startup
    if (context.timeSeconds < 1.0) {
        self.frame = FRAME_stand101 + Math.floor(Math.random() * (FRAME_stand140 - FRAME_stand101 + 1));
    }
}

function actor_walk(self: Entity, context: any) {
    self.monsterinfo.current_move = actor_move_walk;
}

function actor_run(self: Entity, context: any) {
    if ((context.timeSeconds < self.pain_debounce_time) && (!self.enemy)) {
        if (self.movetarget)
            actor_walk(self, context);
        else
            actor_stand(self, context);
        return;
    }

    if (self.monsterinfo.aiflags & AIFlags.StandGround) {
        actor_stand(self, context);
        return;
    }

    self.monsterinfo.current_move = actor_move_run;
}

const messages = [
    "Watch it",
    "#$@*&",
    "Idiot",
    "Check your targets"
];

function actor_pain(self: Entity, other: Entity | null, kick: number, damage: number) {
    // context and fire_wait are not in MonsterInfo type, so we access via context property we added or passed via closure?
    // In SP_misc_actor we stored context in self.monsterinfo as 'any'.
    const context = (self.monsterinfo as any).context;

    // Check if context exists to avoid crashes in tests/edge cases
    if (!context) return;

    if (context.timeSeconds < self.pain_debounce_time)
        return;

    self.pain_debounce_time = context.timeSeconds + 3;

    // Pick random pain sound
    const n = Math.floor(Math.random() * 3);
    let sound = sound_pain1;
    if (n === 1) sound = sound_pain2;
    if (n === 2) sound = sound_pain3;

    context.sound(self, SoundChannel.Voice, sound, 1, ATTN_NORM, 0);

    const random = Math.random();

    if (other && other.client && random < 0.4) {
        const v = subVec3(other.origin, self.origin);
        self.ideal_yaw = vectoyaw(v);

        if (Math.random() < 0.5)
            self.monsterinfo.current_move = actor_move_flipoff;
        else
            self.monsterinfo.current_move = actor_move_taunt;

        // const name = actor_names[(self - g_edicts) % q_countof(actor_names)];
        // We don't have direct access to index, so use random name
        const name = actor_names[Math.floor(Math.random() * actor_names.length)];
        const message = messages[Math.floor(Math.random() * messages.length)];

        context.centerprintf(other, `${name}: ${message}!\n`);
        return;
    }

    if (n === 0)
        self.monsterinfo.current_move = actor_move_pain1;
    else if (n === 1)
        self.monsterinfo.current_move = actor_move_pain2;
    else
        self.monsterinfo.current_move = actor_move_pain3;
}

function actor_setskin(self: Entity, context: any) {
    if (self.health < (self.max_health / 2))
        self.skin = 1;
    else
        self.skin = 0;
}

function actorMachineGun(self: Entity, context: any) {
    // MZ2_ACTOR_MACHINEGUN_1 offset
    const flashOffset: Vec3 = { x: 0, y: 0, z: 0 }; // TODO: verify offset

    // AngleVectors(self.s.angles, forward, right, nullptr);
    const vectors = angleVectors(self.angles);
    const forward = vectors.forward;

    // start = G_ProjectSource(self->s.origin, monster_flash_offset[MZ2_ACTOR_MACHINEGUN_1], forward, right);
    // Approximate project source logic
    const start = copyVec3(self.origin) as MutableVec3;
    // add offsets based on forward/right - defaulting to self.origin for now or simple offset
    start.z += self.viewheight;

    let dir: MutableVec3;

    if (self.enemy) {
        let target: MutableVec3;
        if (self.enemy.health > 0) {
            target = subVec3(self.enemy.origin, scaleVec3(self.enemy.velocity, 0.2)) as MutableVec3;
            target.z += self.enemy.viewheight;
        } else {
            target = copyVec3(self.enemy.absmin) as MutableVec3;
            target.z += (self.enemy.size.z / 2) + 1;
        }
        dir = subVec3(target, start) as MutableVec3;
        dir = normalizeVec3(dir) as MutableVec3;
    } else {
        dir = forward;
    }

    monster_fire_bullet(self, start, dir, 3, 4, 0, 0, MZ2_ACTOR_MACHINEGUN_1, context); // spread default 0 for now
}

function actor_dead(self: Entity, context: any) {
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: -8 };
    self.movetype = MoveType.Toss;
    self.svflags |= 1; // SVF_DEADMONSTER (approximate, not strictly defined in ts port yet?)
    self.nextthink = -1;
    context.linkentity(self);
}

function actor_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod) {
    const context = (self.monsterinfo as any).context;

    // Check if context exists
    if (!context) return;

    // check for gib
    if (self.health <= -80) {
        context.sound(self, SoundChannel.Voice, sound_gib, 1, ATTN_NORM, 0);
        throwGibs(context, self.origin, damage);
        // ThrowGibs also handles head
        self.deadflag = DeadFlag.Dead;
        return;
    }

    if (self.deadflag === DeadFlag.Dead)
        return;

    // regular death
    const n = Math.floor(Math.random() * 2);
    const sound = n === 0 ? sound_die1 : sound_die2;
    context.sound(self, SoundChannel.Voice, sound, 1, ATTN_NORM, 0);

    self.deadflag = DeadFlag.Dead;
    self.takedamage = true;

    if (n === 0)
        self.monsterinfo.current_move = actor_move_death1;
    else
        self.monsterinfo.current_move = actor_move_death2;
}

function actor_fire(self: Entity, context: any) {
    actorMachineGun(self, context);

    const fire_wait = (self.monsterinfo as any).fire_wait ?? 0;

    if (context.timeSeconds >= fire_wait)
        self.monsterinfo.aiflags &= ~AIFlags.HoldFrame;
    else
        self.monsterinfo.aiflags |= AIFlags.HoldFrame;
}

function actor_attack(self: Entity, context: any) {
    self.monsterinfo.current_move = actor_move_attack;
    (self.monsterinfo as any).fire_wait = context.timeSeconds + 1.0 + Math.random() * 1.6;
}

function actor_use(self: Entity, other: Entity | null, activator: Entity | null) {
    const context = (self.monsterinfo as any).context;
    // self->goalentity = self->movetarget = G_PickTarget(self->target);
    const target = context.pickTarget(self.target);
    self.goalentity = target;
    self.movetarget = target;

    if (!self.movetarget || self.movetarget.classname !== 'target_actor') {
        console.log(`${self.classname}: bad target ${self.target}`);
        self.target = undefined;
        self.monsterinfo.pausetime = 100000000; // HOLD_FOREVER
        if (self.monsterinfo.stand) self.monsterinfo.stand(self, context);
        return;
    }

    const goalPos = self.goalentity ? self.goalentity.origin : self.movetarget ? self.movetarget.origin : self.origin;
    const v = subVec3(goalPos, self.origin);
    self.ideal_yaw = vectoyaw(v);
    // Cast to MutableVec3 to assign y
    (self.angles as MutableVec3).y = self.ideal_yaw;
    if (self.monsterinfo.walk) self.monsterinfo.walk(self, context);
    self.target = undefined;
}

function actor_stand_wrapper(self: Entity, context: any) {
    actor_stand(self, context);
}

// Moves

// actor_move_stand
const frames_stand = [
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand)
];
actor_move_stand = {
    firstframe: FRAME_stand101, lastframe: FRAME_stand140,
    frames: frames_stand,
    endfunc: null
};

// actor_move_walk
const frames_walk = [
    m(ai_walk), m(ai_walk, 6), m(ai_walk, 10), m(ai_walk, 3), m(ai_walk, 2), m(ai_walk, 7), m(ai_walk, 10), m(ai_walk, 1)
];
actor_move_walk = {
    firstframe: FRAME_walk01, lastframe: FRAME_walk08,
    frames: frames_walk,
    endfunc: null
};

// actor_move_run
const frames_run = [
    m(ai_run, 4), m(ai_run, 15), m(ai_run, 15), m(ai_run, 8), m(ai_run, 20), m(ai_run, 15)
];
actor_move_run = {
    firstframe: FRAME_run02, lastframe: FRAME_run07,
    frames: frames_run,
    endfunc: null
};

// actor_move_pain1
const frames_pain1 = [
    m(ai_move, -5), m(ai_move, 4), m(ai_move, 1)
];
actor_move_pain1 = {
    firstframe: FRAME_pain101, lastframe: FRAME_pain103,
    frames: frames_pain1,
    endfunc: actor_run
};

// actor_move_pain2
const frames_pain2 = [
    m(ai_move, -4), m(ai_move, 4), m(ai_move)
];
actor_move_pain2 = {
    firstframe: FRAME_pain201, lastframe: FRAME_pain203,
    frames: frames_pain2,
    endfunc: actor_run
};

// actor_move_pain3
const frames_pain3 = [
    m(ai_move, -1), m(ai_move, 1), m(ai_move, 0)
];
actor_move_pain3 = {
    firstframe: FRAME_pain301, lastframe: FRAME_pain303,
    frames: frames_pain3,
    endfunc: actor_run
};

// actor_move_flipoff
const frames_flipoff = [
    m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn)
];
actor_move_flipoff = {
    firstframe: FRAME_flip01, lastframe: FRAME_flip14,
    frames: frames_flipoff,
    endfunc: actor_run
};

// actor_move_taunt
const frames_taunt = [
    m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn), m(ai_turn)
];
actor_move_taunt = {
    firstframe: FRAME_taunt01, lastframe: FRAME_taunt17,
    frames: frames_taunt,
    endfunc: actor_run
};

// actor_move_death1
const frames_death1 = [
    m(ai_move), m(ai_move), m(ai_move, -13), m(ai_move, 14), m(ai_move, 3), m(ai_move, -2), m(ai_move, 1)
];
actor_move_death1 = {
    firstframe: FRAME_death101, lastframe: FRAME_death107,
    frames: frames_death1,
    endfunc: actor_dead
};

// actor_move_death2
const frames_death2 = [
    m(ai_move), m(ai_move, 7), m(ai_move, -6), m(ai_move, -5), m(ai_move, 1), m(ai_move), m(ai_move, -1), m(ai_move, -2), m(ai_move, -1), m(ai_move, -9), m(ai_move, -13), m(ai_move, -13), m(ai_move)
];
actor_move_death2 = {
    firstframe: FRAME_death201, lastframe: FRAME_death213,
    frames: frames_death2,
    endfunc: actor_dead
};

// actor_move_attack
const frames_attack = [
    m(ai_charge, -2, actor_fire), m(ai_charge, -2), m(ai_charge, 3), m(ai_charge, 2)
];
actor_move_attack = {
    firstframe: FRAME_attak01, lastframe: FRAME_attak04,
    frames: frames_attack,
    endfunc: actor_run
};


// Spawn Function
export function SP_misc_actor(self: Entity, context: SpawnContext) {
    // if ( !M_AllowSpawn( self ) ) ... handled by caller or not relevant?

    if (!self.targetname) {
        console.log(`${self.classname}: no targetname`);
        context.entities.free(self);
        return;
    }

    if (!self.target) {
        console.log(`${self.classname}: no target`);
        context.entities.free(self);
        return;
    }

    self.movetarget = null;
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.model = 'players/male/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };

    if (!self.health)
        self.health = 100;
    self.max_health = self.health;
    self.mass = 200;

    self.pain = actor_pain;
    self.die = actor_die;

    // Precache sounds
    context.entities.soundIndex(sound_pain1);
    context.entities.soundIndex(sound_pain2);
    context.entities.soundIndex(sound_pain3);
    context.entities.soundIndex(sound_die1);
    context.entities.soundIndex(sound_die2);
    context.entities.soundIndex(sound_gib);
    context.entities.soundIndex('player/male/jump1.wav');

    self.monsterinfo = {
        ...self.monsterinfo, // Preserve default properties like last_sighting, trail_time, pausetime
        stand: (s) => actor_stand_wrapper(s, context.entities), // Wrap to match signature
        walk: actor_walk,
        run: actor_run,
        attack: actor_attack,
        melee: undefined,
        sight: undefined,
        setskin: (s) => actor_setskin(s, context.entities), // Wrap to match signature
        aiflags: AIFlags.GoodGuy,
        scale: 1.0, // MODEL_SCALE
    };
    // Store context for callbacks (casted to any to bypass type check)
    (self.monsterinfo as any).context = context.entities;

    context.entities.linkentity(self);

    self.monsterinfo.current_move = actor_move_stand;

    // walkmonster_start(self);
    // Equivalent of walkmonster_start:
    // Equivalent of walkmonster_start:
    self.think = (s: Entity) => {
        const c = (s.monsterinfo as any).context;
        if (c) monster_think(s, c);
    };
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;

    // actors always start in a dormant state, they *must* be used to get going
    self.use = (self: Entity, other: Entity | null, activator: Entity | null = null) => actor_use(self, other, activator);
}


const SPAWNFLAG_TARGET_ACTOR_JUMP = 1;
const SPAWNFLAG_TARGET_ACTOR_SHOOT = 2;
const SPAWNFLAG_TARGET_ACTOR_ATTACK = 4;
const SPAWNFLAG_TARGET_ACTOR_HOLD = 16;
const SPAWNFLAG_TARGET_ACTOR_BRUTAL = 32;

function target_actor_touch(self: Entity, other: Entity | null, plane: any, surf: any) {
    if (!other) return;
    const context = (self.monsterinfo as any).context;

    if (other.movetarget !== self)
        return;

    if (other.enemy)
        return;

    other.goalentity = null;
    other.movetarget = null;

    if (self.message) {
        // Broadcast message
        // for (uint32_t n = 1; n <= game.maxclients; n++) ...
        // Using centerprintf or similar
        // gi.LocClient_Print(ent, PRINT_CHAT, "{}: {}\n", actor_names[(other - g_edicts) % q_countof(actor_names)], self->message);
        // We'll just broadcast to all for now as TS port might not have per-client broadcast easy here?
        // Actually context has centerprintf.

        const name = actor_names[Math.floor(Math.random() * actor_names.length)];
        // TODO: iterate clients and print
    }

    if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_JUMP) { // jump
        const v = other.velocity as MutableVec3;
        v.x = self.movedir.x * self.speed;
        v.y = self.movedir.y * self.speed;

        // if (other->groundentity)
        // TS port: groundentity logic might be slightly different
        if (other.groundentity) {
            other.groundentity = null;
            v.z = self.movedir.z;
            context.sound(other, SoundChannel.Voice, 'player/male/jump1.wav', 1, ATTN_NORM, 0);
        }
    }

    if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_SHOOT) { // shoot
        // Not implemented in original source either? It was empty block.
    } else if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_ATTACK) { // attack
        other.enemy = context.pickTarget(self.pathtarget);
        if (other.enemy) {
            other.goalentity = other.enemy;
            if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_BRUTAL)
                other.monsterinfo.aiflags |= AIFlags.Brutal;

            if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_HOLD) {
                other.monsterinfo.aiflags |= AIFlags.StandGround;
                actor_stand(other, context);
            } else {
                actor_run(other, context);
            }
        }
    }

    if (!(self.spawnflags & (SPAWNFLAG_TARGET_ACTOR_ATTACK | SPAWNFLAG_TARGET_ACTOR_SHOOT)) && (self.pathtarget)) {
        const savetarget = self.target;
        self.target = self.pathtarget;
        context.useTargets(self, other); // G_UseTargets
        self.target = savetarget;
    }

    other.movetarget = context.pickTarget(self.target);

    if (!other.goalentity)
        other.goalentity = other.movetarget;

    if (!other.movetarget && !other.enemy) {
        other.monsterinfo.pausetime = 100000000;
        if (other.monsterinfo.stand) other.monsterinfo.stand(other, context);
    } else if (other.movetarget === other.goalentity && other.movetarget) {
        const v = subVec3(other.movetarget.origin, other.origin);
        other.ideal_yaw = vectoyaw(v);
    }
}

export function SP_target_actor(self: Entity, context: SpawnContext) {
    if (!self.targetname)
        console.log(`${self.classname}: no targetname`);

    self.solid = Solid.Trigger;
    self.touch = target_actor_touch;
    self.mins = { x: -8, y: -8, z: -8 };
    self.maxs = { x: 8, y: 8, z: 8 };
    self.svflags = 1 << 6; // SVF_NOCLIENT

    self.monsterinfo = {
        ...self.monsterinfo,
    };
    (self.monsterinfo as any).context = context.entities; // Store context for touch

    if (self.spawnflags & SPAWNFLAG_TARGET_ACTOR_JUMP) {
        if (!self.speed)
            self.speed = 200;

        // st.height replacement. Assuming it comes from custom property or use speed/movedir.
        // Original source uses st.height which is a spawn temp global.
        // In TS port we usually look at self properties.
        const height = (self as any).height || 200;

        if (self.angles.y === 0)
            (self.angles as MutableVec3).y = 360;

        const dir = setMovedir(self.angles) as MutableVec3;
        dir.z = height;
        self.movedir = dir;
    }

    context.entities.linkentity(self);
}

export function registerActorSpawns(registry: SpawnRegistry): void {
    registry.register('misc_actor', SP_misc_actor);
    registry.register('target_actor', SP_target_actor);
}
