import { Entity, MonsterFrame, MonsterMove, MoveType, Solid, DeadFlag, EntityFlags } from '../entity.js';
import { monster_think, ai_stand, ai_walk, ai_run, ai_move, AIFlags } from '../../ai/index.js';
import { throwGibs } from '../gibs.js';
import { SpawnContext, SpawnRegistry } from '../spawn.js';
import { DamageMod } from '../../combat/damageMods.js';

const MONSTER_TICK = 0.1;

const SPAWNFLAG_INSANE_CRAWL = 4;
const SPAWNFLAG_INSANE_CRUCIFIED = 8;
const SPAWNFLAG_INSANE_STAND_GROUND = 16;
const SPAWNFLAG_INSANE_ALWAYS_STAND = 32;
const SPAWNFLAG_INSANE_QUIET = 64;

// Frames
const FRAME_stand1 = 0;
const FRAME_stand40 = 39;
const FRAME_stand41 = 40;
const FRAME_stand59 = 58;
const FRAME_stand60 = 59;
const FRAME_stand65 = 64;
const FRAME_stand94 = 93;
const FRAME_stand96 = 95;
const FRAME_stand100 = 99;
const FRAME_stand160 = 159;

const FRAME_walk27 = 160;
const FRAME_walk39 = 172;
const FRAME_walk1 = 173;
const FRAME_walk26 = 198;

const FRAME_st_pain2 = 199;
const FRAME_st_pain12 = 209;

const FRAME_st_death2 = 210;
const FRAME_st_death18 = 226;

const FRAME_crawl1 = 227;
const FRAME_crawl9 = 235;

const FRAME_cr_pain2 = 236;
const FRAME_cr_pain10 = 244;

const FRAME_cr_death10 = 245;
const FRAME_cr_death16 = 251;

const FRAME_cross1 = 252;
const FRAME_cross15 = 266;
const FRAME_cross16 = 267;
const FRAME_cross30 = 281;

// Forward declarations
let insane_move_stand_normal: MonsterMove;
let insane_move_stand_insane: MonsterMove;
let insane_move_uptodown: MonsterMove;
let insane_move_downtoup: MonsterMove;
let insane_move_jumpdown: MonsterMove;
let insane_move_down: MonsterMove;
let insane_move_walk_normal: MonsterMove;
let insane_move_run_normal: MonsterMove;
let insane_move_walk_insane: MonsterMove;
let insane_move_run_insane: MonsterMove;
let insane_move_stand_pain: MonsterMove;
let insane_move_stand_death: MonsterMove;
let insane_move_crawl: MonsterMove;
let insane_move_runcrawl: MonsterMove;
let insane_move_crawl_pain: MonsterMove;
let insane_move_crawl_death: MonsterMove;
let insane_move_cross: MonsterMove;
let insane_move_struggle_cross: MonsterMove;

// Sounds
const sound_fist = 'insane/insane11.wav';
const sound_shake = 'insane/insane5.wav';
const sound_moan = 'insane/insane7.wav';
const sound_screams = [
    'insane/insane1.wav',
    'insane/insane2.wav',
    'insane/insane3.wav',
    'insane/insane4.wav',
    'insane/insane6.wav',
    'insane/insane8.wav',
    'insane/insane9.wav',
    'insane/insane10.wav'
];

function insane_fist(self: Entity, context: any) {
    context.sound(self, 2, sound_fist, 1, 1, 0);
}

function insane_shake(self: Entity, context: any) {
    if ((self.spawnflags & SPAWNFLAG_INSANE_QUIET) === 0) {
        context.sound(self, 2, sound_shake, 1, 1, 0);
    }
}

function insane_moan(self: Entity, context: any) {
    if (self.spawnflags & SPAWNFLAG_INSANE_QUIET) return;

    if ((self.monsterinfo.attack_finished ?? 0) < context.timeSeconds) {
        context.sound(self, 2, sound_moan, 1, 1, 0);
        self.monsterinfo.attack_finished = context.timeSeconds + 1 + context.rng.frandom() * 2;
    }
}

function insane_scream(self: Entity, context: any) {
    if (self.spawnflags & SPAWNFLAG_INSANE_QUIET) return;

    if ((self.monsterinfo.attack_finished ?? 0) < context.timeSeconds) {
        const sound = sound_screams[Math.floor(context.rng.frandom() * sound_screams.length)];
        context.sound(self, 2, sound, 1, 1, 0);
        self.monsterinfo.attack_finished = context.timeSeconds + 1 + context.rng.frandom() * 2;
    }
}

function monster_footstep(self: Entity, context: any) {
    // Footsteps
}

// Logic functions
function insane_checkdown(self: Entity, context: any) {
    if (self.spawnflags & SPAWNFLAG_INSANE_ALWAYS_STAND) return;
    if (context.rng.frandom() < 0.3) {
        if (context.rng.frandom() < 0.5) {
            self.monsterinfo.current_move = insane_move_uptodown;
        } else {
            self.monsterinfo.current_move = insane_move_jumpdown;
        }
    }
}

function insane_checkup(self: Entity, context: any) {
    if ((self.spawnflags & SPAWNFLAG_INSANE_CRAWL) && (self.spawnflags & SPAWNFLAG_INSANE_STAND_GROUND)) return;
    if (context.rng.frandom() < 0.5) {
        self.monsterinfo.current_move = insane_move_downtoup;
    }
}

function insane_onground(self: Entity, context: any) {
    self.monsterinfo.current_move = insane_move_down;
}

function insane_cross_func(self: Entity, context: any) {
    if (context.rng.frandom() < 0.8) {
        self.monsterinfo.current_move = insane_move_cross;
    } else {
        self.monsterinfo.current_move = insane_move_struggle_cross;
    }
}

function insane_stand(self: Entity, context: any) {
    if (self.spawnflags & SPAWNFLAG_INSANE_CRUCIFIED) {
        self.monsterinfo.current_move = insane_move_cross;
        self.monsterinfo.aiflags |= AIFlags.StandGround;
    } else if ((self.spawnflags & SPAWNFLAG_INSANE_CRAWL) && (self.spawnflags & SPAWNFLAG_INSANE_STAND_GROUND)) {
        self.monsterinfo.current_move = insane_move_down;
    } else if (context.rng.frandom() < 0.5) {
        self.monsterinfo.current_move = insane_move_stand_normal;
    } else {
        self.monsterinfo.current_move = insane_move_stand_insane;
    }
}

function insane_walk(self: Entity, context: any) {
    if ((self.spawnflags & SPAWNFLAG_INSANE_STAND_GROUND) && self.frame === FRAME_cr_pain10) {
        self.monsterinfo.current_move = insane_move_down;
        return;
    }
    if (self.spawnflags & SPAWNFLAG_INSANE_CRAWL) {
        self.monsterinfo.current_move = insane_move_crawl;
    } else if (context.rng.frandom() <= 0.5) {
        self.monsterinfo.current_move = insane_move_walk_normal;
    } else {
        self.monsterinfo.current_move = insane_move_walk_insane;
    }
}

function insane_run(self: Entity, context: any) {
    if ((self.spawnflags & SPAWNFLAG_INSANE_STAND_GROUND) && self.frame === FRAME_cr_pain10) {
        self.monsterinfo.current_move = insane_move_down;
        return;
    }

    const frame = self.frame;
    const isCrawling = (self.spawnflags & SPAWNFLAG_INSANE_CRAWL) ||
        (frame >= FRAME_cr_pain2 && frame <= FRAME_cr_pain10) ||
        (frame >= FRAME_crawl1 && frame <= FRAME_crawl9) ||
        (frame >= FRAME_stand100 && frame <= FRAME_stand160);

    if (isCrawling) {
        self.monsterinfo.current_move = insane_move_runcrawl;
    } else if (context.rng.frandom() <= 0.5) {
        self.monsterinfo.current_move = insane_move_run_normal;
    } else {
        self.monsterinfo.current_move = insane_move_run_insane;
    }
}

function insane_dead(self: Entity, context: any) {
    if (self.spawnflags & SPAWNFLAG_INSANE_CRUCIFIED) {
        self.flags |= EntityFlags.Fly;
    } else {
        self.mins = { x: -16, y: -16, z: -24 };
        self.maxs = { x: 16, y: 16, z: -8 };
        self.movetype = MoveType.Toss;
        // Important: Update collision bounds in physics world
        context.linkentity(self);
    }
    self.nextthink = -1;
}

function m(ai: any, dist: number = 0, think?: (self: Entity, context: any) => void): MonsterFrame {
    return { ai: (s, d, c) => {
        if (think) think(s, c);
        ai(s, dist, MONSTER_TICK, c);
    }, dist };
}

// insane_move_stand_normal
const frames_stand_normal = [
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand, 0, insane_checkdown)
];
insane_move_stand_normal = {
    firstframe: FRAME_stand60, lastframe: FRAME_stand65,
    frames: frames_stand_normal,
    endfunc: insane_stand
};

// insane_move_stand_insane
const frames_stand_insane = [
    m(ai_stand, 0, insane_shake),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand), m(ai_stand), m(ai_stand),
    m(ai_stand, 0, insane_checkdown)
];
insane_move_stand_insane = {
    firstframe: FRAME_stand65, lastframe: FRAME_stand94,
    frames: frames_stand_insane,
    endfunc: insane_stand
};

// insane_move_uptodown
const frames_uptodown = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move, 0, insane_moan), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move),
    m(ai_move, 2.7), m(ai_move, 4.1), m(ai_move, 6), m(ai_move, 7.6), m(ai_move, 3.6),
    m(ai_move), m(ai_move), m(ai_move, 0, insane_fist), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, insane_fist), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_uptodown = {
    firstframe: FRAME_stand1, lastframe: FRAME_stand40,
    frames: frames_uptodown,
    endfunc: insane_onground
};

// insane_move_downtoup
const frames_downtoup = [
    m(ai_move, -0.7), m(ai_move, -1.2), m(ai_move, -1.5), m(ai_move, -4.5), m(ai_move, -3.5),
    m(ai_move, -0.2), m(ai_move), m(ai_move, -1.3), m(ai_move, -3), m(ai_move, -2),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move, -3.3), m(ai_move, -1.6),
    m(ai_move, -0.3), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_downtoup = {
    firstframe: FRAME_stand41, lastframe: FRAME_stand59,
    frames: frames_downtoup,
    endfunc: insane_stand
};

// insane_move_jumpdown
const frames_jumpdown = [
    m(ai_move, 0.2), m(ai_move, 11.5), m(ai_move, 5.1), m(ai_move, 7.1), m(ai_move)
];
insane_move_jumpdown = {
    firstframe: FRAME_stand96, lastframe: FRAME_stand100,
    frames: frames_jumpdown,
    endfunc: insane_onground
};

// insane_move_down
const frames_down = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move, -1.7), m(ai_move, -1.6), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move, 0, insane_fist), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, insane_moan), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move, 0.5), m(ai_move), m(ai_move, -0.2, insane_scream), m(ai_move),
    m(ai_move, 0.2), m(ai_move, 0.4), m(ai_move, 0.6), m(ai_move, 0.8), m(ai_move, 0.7),
    m(ai_move, 0, insane_checkup)
];
insane_move_down = {
    firstframe: FRAME_stand100, lastframe: FRAME_stand160,
    frames: frames_down,
    endfunc: insane_onground
};

// insane_move_walk_normal
const frames_walk_normal = [
    m(ai_walk, 0, insane_scream), m(ai_walk, 2.5), m(ai_walk, 3.5), m(ai_walk, 1.7),
    m(ai_walk, 2.3), m(ai_walk, 2.4), m(ai_walk, 2.2, monster_footstep), m(ai_walk, 4.2),
    m(ai_walk, 5.6), m(ai_walk, 3.3), m(ai_walk, 2.4), m(ai_walk, 0.9), m(ai_walk, 0, monster_footstep)
];
insane_move_walk_normal = {
    firstframe: FRAME_walk27, lastframe: FRAME_walk39,
    frames: frames_walk_normal,
    endfunc: insane_walk
};

// insane_move_run_normal - uses same frames/distances as walk but with ai_run
insane_move_run_normal = {
    firstframe: FRAME_walk27, lastframe: FRAME_walk39,
    frames: frames_walk_normal.map(f => ({
        ai: (s, d, c) => {
            if (f.ai === frames_walk_normal[0].ai) insane_scream(s, c);
            ai_run(s, d as number, MONSTER_TICK, c);
        },
        dist: f.dist
    })),
    endfunc: insane_run
};


// insane_move_walk_insane
const frames_walk_insane = [
    m(ai_walk, 0, insane_scream), m(ai_walk, 3.4), m(ai_walk, 3.6), m(ai_walk, 2.9), m(ai_walk, 2.2),
    m(ai_walk, 2.6, monster_footstep), m(ai_walk), m(ai_walk, 0.7), m(ai_walk, 4.8), m(ai_walk, 5.3),
    m(ai_walk, 1.1), m(ai_walk, 2, monster_footstep), m(ai_walk, 0.5), m(ai_walk), m(ai_walk),
    m(ai_walk, 4.9), m(ai_walk, 6.7), m(ai_walk, 3.8), m(ai_walk, 2, monster_footstep), m(ai_walk, 0.2),
    m(ai_walk), m(ai_walk, 3.4), m(ai_walk, 6.4), m(ai_walk, 5), m(ai_walk, 1.8, monster_footstep), m(ai_walk)
];
insane_move_walk_insane = {
    firstframe: FRAME_walk1, lastframe: FRAME_walk26,
    frames: frames_walk_insane,
    endfunc: insane_walk
};

// insane_move_run_insane - same frames but ai_run
insane_move_run_insane = {
    firstframe: FRAME_walk1, lastframe: FRAME_walk26,
    frames: frames_walk_insane.map(f => ({
        ai: (s, d, c) => {
            if (f.ai === frames_walk_insane[0].ai) insane_scream(s, c);
            ai_run(s, d as number, MONSTER_TICK, c);
        },
        dist: f.dist
    })),
    endfunc: insane_run
};

// insane_move_stand_pain
const frames_stand_pain = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, monster_footstep),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, monster_footstep)
];
insane_move_stand_pain = {
    firstframe: FRAME_st_pain2, lastframe: FRAME_st_pain12,
    frames: frames_stand_pain,
    endfunc: insane_run
};

// insane_move_stand_death
const frames_stand_death = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, monster_footstep),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, monster_footstep),
    m(ai_move), m(ai_move, 0, monster_footstep), m(ai_move), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_stand_death = {
    firstframe: FRAME_st_death2, lastframe: FRAME_st_death18,
    frames: frames_stand_death,
    endfunc: insane_dead
};

// insane_move_crawl
const frames_crawl = [
    m(ai_walk, 0, insane_scream), m(ai_walk, 1.5), m(ai_walk, 2.1), m(ai_walk, 3.6),
    m(ai_walk, 2, monster_footstep), m(ai_walk, 0.9), m(ai_walk, 3), m(ai_walk, 3.4),
    m(ai_walk, 2.4, monster_footstep)
];
insane_move_crawl = {
    firstframe: FRAME_crawl1, lastframe: FRAME_crawl9,
    frames: frames_crawl,
    endfunc: insane_walk
};
insane_move_runcrawl = {
    firstframe: FRAME_crawl1, lastframe: FRAME_crawl9,
    frames: frames_crawl,
    endfunc: insane_run
};

// insane_move_crawl_pain
const frames_crawl_pain = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_crawl_pain = {
    firstframe: FRAME_cr_pain2, lastframe: FRAME_cr_pain10,
    frames: frames_crawl_pain,
    endfunc: insane_run
};

// insane_move_crawl_death
const frames_crawl_death = [
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move, 0, insane_scream), m(ai_move), m(ai_move)
];
insane_move_crawl_death = {
    firstframe: FRAME_cr_death10, lastframe: FRAME_cr_death16,
    frames: frames_crawl_death,
    endfunc: insane_dead
};

// insane_move_cross
const frames_cross = [
    m(ai_move, 0, insane_moan), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_cross = {
    firstframe: FRAME_cross1, lastframe: FRAME_cross15,
    frames: frames_cross,
    endfunc: insane_cross_func
};

// insane_move_struggle_cross
const frames_struggle_cross = [
    m(ai_move, 0, insane_scream), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move),
    m(ai_move), m(ai_move), m(ai_move), m(ai_move), m(ai_move)
];
insane_move_struggle_cross = {
    firstframe: FRAME_cross16, lastframe: FRAME_cross30,
    frames: frames_struggle_cross,
    endfunc: insane_cross_func
};


export function SP_misc_insane(self: Entity, context: SpawnContext) {
    if (context.entities.deathmatch) {
        context.entities.free(self);
        return;
    }

    self.model = 'models/monsters/insane/tris.md2';
    self.mins = { x: -16, y: -16, z: -24 };
    self.maxs = { x: 16, y: 16, z: 32 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;

    self.health = 100;
    self.max_health = 100;
    self.mass = 300;
    self.takedamage = true;

    self.pain = (self, other, kick, damage) => {
        if (context.entities.timeSeconds < self.pain_debounce_time) return;
        self.pain_debounce_time = context.entities.timeSeconds + 3;

        const r = 1 + Math.floor(context.entities.rng.frandom() * 2);
        let l = 100;
        if (self.health < 25) l = 25;
        else if (self.health < 50) l = 50;
        else if (self.health < 75) l = 75;

        context.entities.sound(self, 2, `player/male/pain${l}_${r}.wav`, 1, 1, 0);

        if (self.spawnflags & SPAWNFLAG_INSANE_CRUCIFIED) {
            self.monsterinfo.current_move = insane_move_struggle_cross;
            return;
        }

        const frame = self.frame;
        if ((frame >= FRAME_crawl1 && frame <= FRAME_crawl9) ||
            (frame >= FRAME_stand100 && frame <= FRAME_stand160) ||
            (frame >= FRAME_stand1 && frame <= FRAME_stand40)) {
            self.monsterinfo.current_move = insane_move_crawl_pain;
        } else {
            self.monsterinfo.current_move = insane_move_stand_pain;
        }
    };

    self.die = (self, inflictor, attacker, damage, point) => {
        if (self.health <= -50) { // gib_health is typically -40 or -50
            context.entities.sound(self, 2, 'misc/udeath.wav', 1, 1, 0);
            throwGibs(context.entities, self.origin, damage);
            self.deadflag = DeadFlag.Dead;
            self.takedamage = false;
            context.entities.free(self);
            return;
        }

        if (self.deadflag === DeadFlag.Dead) return;

        const deathSound = `player/male/death${1 + Math.floor(context.entities.rng.frandom() * 5)}.wav`;
        context.entities.sound(self, 2, deathSound, 1, 1, 0);

        self.deadflag = DeadFlag.Dead;
        self.takedamage = true;

        if (self.spawnflags & SPAWNFLAG_INSANE_CRUCIFIED) {
            insane_dead(self, context.entities);
        } else {
            const frame = self.frame;
            if ((frame >= FRAME_crawl1 && frame <= FRAME_crawl9) ||
                (frame >= FRAME_stand100 && frame <= FRAME_stand160)) {
                self.monsterinfo.current_move = insane_move_crawl_death;
            } else {
                self.monsterinfo.current_move = insane_move_stand_death;
            }
        }
    };

    self.monsterinfo = {
        ...self.monsterinfo,
        stand: insane_stand,
        walk: insane_walk,
        run: insane_run,
        attack: undefined,
        melee: undefined,
        sight: undefined,
        aiflags: self.monsterinfo.aiflags | AIFlags.GoodGuy
    };

    context.entities.linkentity(self);

    if (self.spawnflags & SPAWNFLAG_INSANE_STAND_GROUND) {
        self.monsterinfo.aiflags |= AIFlags.StandGround;
    }

    self.monsterinfo.current_move = insane_move_stand_normal;
    self.monsterinfo.scale = 1.0;

    self.think = monster_think;
    self.nextthink = context.entities.timeSeconds + MONSTER_TICK;

    if (self.spawnflags & SPAWNFLAG_INSANE_CRUCIFIED) {
        self.mass = 100000;
    }

    // Random skin
    self.skin = Math.floor(context.entities.rng.frandom() * 3);
}

export function registerInsaneSpawns(registry: SpawnRegistry): void {
    registry.register('misc_insane', SP_misc_insane);
}
