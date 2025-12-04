import {
  angleVectors,
  scaleVec3,
  addVec3,
  normalizeVec3,
  subtractVec3,
  Vec3,
  ZERO_VEC3,
  MASK_SHOT,
  CONTENTS_SOLID,
  CONTENTS_MONSTER,
  CONTENTS_PLAYER,
  CONTENTS_DEADMONSTER,
  ServerCommand,
  TempEntity,
} from '@quake2ts/shared';
import { MulticastType } from '../../imports.js';
import {
  ai_charge,
  ai_move,
  ai_run,
  ai_stand,
  ai_walk,
  monster_think,
  RangeCategory
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
import { GIB_METALLIC, throwGibs } from '../gibs.js';
import {
  monster_fire_blaster,
  monster_fire_dabeam,
  monster_fire_hit,
} from './attack.js';
import { DamageMod } from '../../combat/damageMods.js';
import { DamageFlags } from '../../combat/damageFlags.js';
import { T_Damage, Damageable } from '../../combat/damage.js';
import {
  M_SetAnimation,
  M_AllowSpawn,
  M_ProjectFlashSource,
  M_CheckGib,
  M_ShouldReactToPain,
} from './common.js';
import { visible, rangeTo } from '../../ai/perception.js';
import { EntitySystem } from '../system.js';

const MONSTER_TICK = 0.1;
const MODEL_SCALE = 1.0;
const MELEE_DISTANCE = 80;

// Frame constants
const FRAME_idle1 = 76;
const FRAME_idle52 = 127;
const FRAME_walk1 = 160;
const FRAME_walk19 = 178;
const FRAME_pain1_1 = 68;
const FRAME_pain1_8 = 75;
const FRAME_atk1_out1 = 40;
const FRAME_atk1_out3 = 42;
const FRAME_atk1_spin1 = 184;
const FRAME_atk1_spin12 = 195;
const FRAME_atk1_spin15 = 198;
const FRAME_atk1_in1 = 128;
const FRAME_atk1_in3 = 130;
const FRAME_atk2_out1 = 43;
const FRAME_atk2_out7 = 49;
const FRAME_atk2_fire1 = 199;
const FRAME_atk2_fire4 = 202;
const FRAME_atk2_in1 = 214;
const FRAME_atk2_in12 = 225;
const FRAME_kick_in1 = 131;
const FRAME_kick_in13 = 143;
const FRAME_death1 = 14;
const FRAME_death26 = 39;

// Sound management
const sound_step = 'zortemp/step.wav';
const sound_charge = 'weapons/hyprbu1a.wav';
const sound_spin_loop = 'weapons/hyprbl1a.wav';
const sound_laser = 'weapons/laser2.wav';

type MutableVec3 = { x: number; y: number; z: number };

// Forward declarations
let guardian_move_stand: MonsterMove;
let guardian_move_walk: MonsterMove;
let guardian_move_run: MonsterMove;
let guardian_move_pain1: MonsterMove;
let guardian_atk1_out: MonsterMove;
let guardian_move_atk1_spin: MonsterMove;
let guardian_move_atk1_in: MonsterMove;
let guardian_move_atk2_out: MonsterMove;
let guardian_move_atk2_fire: MonsterMove;
let guardian_move_atk2_in: MonsterMove;
let guardian_move_kick: MonsterMove;
let guardian_move_death: MonsterMove;
let guardian_move_atk1_spin_loop: MonsterMove;

// Helpers to wrap AI functions to match AIAction signature
function guardian_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
  ai_stand(self, MONSTER_TICK, context);
}

function guardian_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
  ai_walk(self, dist, MONSTER_TICK, context);
}

function guardian_ai_run(self: Entity, dist: number, context: EntitySystem): void {
  ai_run(self, dist, MONSTER_TICK, context);
}

function guardian_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
  ai_charge(self, dist, MONSTER_TICK, context);
}

function guardian_ai_move(self: Entity, dist: number, context: EntitySystem): void {
  ai_move(self, dist);
}


//
// Stand
//

function guardian_stand(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, guardian_move_stand, context);
}

const guardian_frames_stand: MonsterFrame[] = Array(52).fill({ ai: guardian_ai_stand, dist: 0 });
guardian_move_stand = {
  firstframe: FRAME_idle1,
  lastframe: FRAME_idle52,
  frames: guardian_frames_stand,
  endfunc: null,
};

//
// Walk
//

function guardian_footstep(self: Entity, context: EntitySystem): void {
  context.sound(self, 2, sound_step, 1.0, 1.0, 0.0);
}

const guardian_frames_walk: MonsterFrame[] = [
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8, think: guardian_footstep },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8 },
  { ai: guardian_ai_walk, dist: 8, think: guardian_footstep },
  { ai: guardian_ai_walk, dist: 8 },
];
guardian_move_walk = {
  firstframe: FRAME_walk1,
  lastframe: FRAME_walk19,
  frames: guardian_frames_walk,
  endfunc: null,
};

function guardian_walk(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, guardian_move_walk, context);
}

//
// Run
//

const guardian_frames_run: MonsterFrame[] = [
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8, think: guardian_footstep },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8 },
  { ai: guardian_ai_run, dist: 8, think: guardian_footstep },
  { ai: guardian_ai_run, dist: 8 },
];
guardian_move_run = {
  firstframe: FRAME_walk1,
  lastframe: FRAME_walk19,
  frames: guardian_frames_run,
  endfunc: null,
};

function guardian_run(self: Entity, context: EntitySystem): void {
  M_SetAnimation(self, guardian_move_run, context);
}

//
// Pain
//

const guardian_frames_pain1: MonsterFrame[] = Array(8).fill({ ai: guardian_ai_move, dist: 0 });
guardian_move_pain1 = {
  firstframe: FRAME_pain1_1,
  lastframe: FRAME_pain1_8,
  frames: guardian_frames_pain1,
  endfunc: guardian_run,
};

function guardian_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (damage <= 10) return;

    // Don't go into pain while attacking
    const frame = self.frame;
    if (frame >= FRAME_atk1_spin1 && frame <= FRAME_atk1_spin15) return;
    if (frame >= FRAME_atk2_fire1 && frame <= FRAME_atk2_fire4) return;
    if (frame >= FRAME_kick_in1 && frame <= FRAME_kick_in13) return;

    if (!M_ShouldReactToPain(self, context)) return;

    M_SetAnimation(self, guardian_move_pain1, context);
}

//
// Attack 1 (Blaster)
//

const guardian_frames_atk1_out: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_atk1_out = {
    firstframe: FRAME_atk1_out1,
    lastframe: FRAME_atk1_out3,
    frames: guardian_frames_atk1_out,
    endfunc: guardian_run
};

function guardian_atk1_finish(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, guardian_atk1_out, context);
}

function guardian_atk1_charge(self: Entity, context: EntitySystem): void {
    context.sound(self, 1, sound_charge, 1.0, 1.0, 0.0);
}

function guardian_fire_blaster_func(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const { forward, right } = angleVectors(self.angles);

    // Hardcoding an offset for now
    const start: MutableVec3 = addVec3(self.origin, scaleVec3(forward, 20));
    start.z += self.viewheight ? self.viewheight - 10 : 0;
    start.x += right.x * 20;
    start.y += right.y * 20;

    const target: MutableVec3 = { ...self.enemy.origin };
    target.z += self.enemy.viewheight || 0;

    target.x += (Math.random() * 2 - 1) * 5;
    target.y += (Math.random() * 2 - 1) * 5;
    target.z += (Math.random() * 2 - 1) * 5;

    const dir = normalizeVec3(subtractVec3(target, start));

    monster_fire_blaster(self, start, dir, 2, 1000, 0, 0, context, DamageMod.HYPERBLASTER);
}

// Wrapping loop logic
function guardian_fire_blaster_loop(self: Entity, context: EntitySystem): void {
    guardian_fire_blaster_func(self, context);

    if (self.enemy && self.enemy.health > 0 &&
        self.frame === FRAME_atk1_spin12 &&
        self.timestamp > context.timeSeconds &&
        visible(self, self.enemy, context.trace)) {
            M_SetAnimation(self, guardian_move_atk1_spin_loop, context);
    }
}

const guardian_frames_atk1_spin: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0, think: guardian_atk1_charge },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func }, // 5
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_func },
    { ai: guardian_ai_charge, dist: 0, think: guardian_fire_blaster_loop }, // 12
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_move_atk1_spin = {
    firstframe: FRAME_atk1_spin1,
    lastframe: FRAME_atk1_spin15,
    frames: guardian_frames_atk1_spin,
    endfunc: guardian_atk1_finish
};

// Loop subset
guardian_move_atk1_spin_loop = {
    firstframe: FRAME_atk1_spin1 + 4,
    lastframe: FRAME_atk1_spin15,
    frames: guardian_frames_atk1_spin.slice(4),
    endfunc: guardian_atk1_finish
};


function guardian_atk1(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, guardian_move_atk1_spin, context);
    self.timestamp = context.timeSeconds + 0.65 + Math.random() * 1.5;
}

const guardian_frames_atk1_in: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_move_atk1_in = {
    firstframe: FRAME_atk1_in1,
    lastframe: FRAME_atk1_in3,
    frames: guardian_frames_atk1_in,
    endfunc: guardian_atk1
};

//
// Attack 2 (Laser)
//

const guardian_frames_atk2_out: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_move_atk2_out = {
    firstframe: FRAME_atk2_out1,
    lastframe: FRAME_atk2_out7,
    frames: guardian_frames_atk2_out,
    endfunc: guardian_run
};

function guardian_atk2_out(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, guardian_move_atk2_out, context);
}

const laser_positions = [
    { x: 125.0, y: -70.0, z: 60.0 },
    { x: 112.0, y: -62.0, z: 60.0 }
];

function guardian_fire_update(laser: Entity, context: EntitySystem): void {
    const self = laser.owner;
    if (!self || !self.inUse) {
        context.free(laser);
        return;
    }

    const { forward, right } = angleVectors(self.angles);

    const offset = laser_positions[1 - (self.frame & 1)];

    const start: MutableVec3 = addVec3(self.origin, scaleVec3(forward, offset.x));
    start.z += offset.z;
    start.x += right.x * offset.y;
    start.y += right.y * offset.y;
    start.z += right.z * offset.y;

    if (!self.enemy) return;

    const target: MutableVec3 = addVec3(self.enemy.origin, self.enemy.mins);
    target.x += Math.random() * self.enemy.size.x;
    target.y += Math.random() * self.enemy.size.y;
    target.z += Math.random() * self.enemy.size.z;

    const dir = normalizeVec3(subtractVec3(target, start));

    laser.origin = start;
    laser.movedir = dir;
    context.linkentity(laser);
}

function guardian_laser_fire(self: Entity, context: EntitySystem): void {
    context.sound(self, 1, sound_laser, 1.0, 1.0, 0.0);
    monster_fire_dabeam(self, 25, (self.frame % 2) !== 0, guardian_fire_update, context);
}

const guardian_frames_atk2_fire: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0, think: guardian_laser_fire },
    { ai: guardian_ai_charge, dist: 0, think: guardian_laser_fire },
    { ai: guardian_ai_charge, dist: 0, think: guardian_laser_fire },
    { ai: guardian_ai_charge, dist: 0, think: guardian_laser_fire },
];
guardian_move_atk2_fire = {
    firstframe: FRAME_atk2_fire1,
    lastframe: FRAME_atk2_fire4,
    frames: guardian_frames_atk2_fire,
    endfunc: guardian_atk2_out
};

function guardian_atk2(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, guardian_move_atk2_fire, context);
}

const guardian_frames_atk2_in: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_move_atk2_in = {
    firstframe: FRAME_atk2_in1,
    lastframe: FRAME_atk2_in12,
    frames: guardian_frames_atk2_in,
    endfunc: guardian_atk2
};

//
// Kick
//

function guardian_kick(self: Entity, context: EntitySystem): void {
    const aim = { x: MELEE_DISTANCE, y: 0, z: -80 }; // aim vector
    if (!monster_fire_hit(self, aim, 85, 700, context)) {
        self.monsterinfo.melee_debounce_time = context.timeSeconds + 1.0;
    }
}

const guardian_frames_kick: MonsterFrame[] = [
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_kick },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0, think: guardian_footstep },
    { ai: guardian_ai_charge, dist: 0 },
    { ai: guardian_ai_charge, dist: 0 },
];
guardian_move_kick = {
    firstframe: FRAME_kick_in1,
    lastframe: FRAME_kick_in13,
    frames: guardian_frames_kick,
    endfunc: guardian_run
};

//
// Attack Selection
//

function guardian_attack(self: Entity, context: EntitySystem): void {
    if (!self.enemy || !self.enemy.inUse) return;

    const r = rangeTo(self, self.enemy);

    if (r > 500) { // RANGE_NEAR assumed 500
        M_SetAnimation(self, guardian_move_atk2_in, context);
    } else if (context.timeSeconds > (self.monsterinfo.melee_debounce_time ?? 0) && r < 120) {
        M_SetAnimation(self, guardian_move_kick, context);
    } else {
        M_SetAnimation(self, guardian_move_atk1_in, context);
    }
}


//
// Death
//

function guardian_explode(self: Entity, context: EntitySystem): void {
    const org = {
        x: self.origin.x + self.mins.x + Math.random() * self.size.x,
        y: self.origin.y + self.mins.y + Math.random() * self.size.y,
        z: self.origin.z + self.mins.z + Math.random() * self.size.z,
    };
    context.multicast(self.origin, MulticastType.All, ServerCommand.temp_entity, TempEntity.EXPLOSION1_BIG, org);
}

function guardian_dead(self: Entity, context: EntitySystem): void {
    for (let i = 0; i < 3; i++) {
        guardian_explode(self, context);
    }

    throwGibs(context, self.origin, 250, GIB_METALLIC);

    self.nextthink = -1;
}

function BossExplode(self: Entity, context: EntitySystem): void {
    guardian_explode(self, context);
}

const guardian_frames_death1: MonsterFrame[] = [
    { ai: guardian_ai_move, dist: 0, think: BossExplode },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
    { ai: guardian_ai_move, dist: 0 },
];
guardian_move_death = {
    firstframe: FRAME_death1,
    lastframe: FRAME_death26,
    frames: guardian_frames_death1,
    endfunc: guardian_dead
};

//
// Spawn
//

export function SP_monster_guardian(self: Entity, context: SpawnContext): void {
  if (!M_AllowSpawn(self, context.entities)) {
    context.entities.free(self);
    return;
  }

  self.classname = 'monster_guardian';
  self.model = 'models/monsters/guardian/tris.md2';
  self.mins = { x: -96, y: -96, z: -66 };
  self.maxs = { x: 96, y: 96, z: 62 };
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;

  self.health = 2500;
  // self.gib_health = -200; // Not in type

  self.mass = 850;

  // Define pain and die with captured context
  self.pain = (ent, other, kick, damage) => {
      guardian_pain(ent, other, kick, damage, context.entities);
  };

  self.die = (ent, inflictor, attacker, damage, point, mod) => {
      // self.monsterinfo.weapon_sound = 0;
      ent.deadflag = DeadFlag.Dead;
      ent.takedamage = true;

      if (ent.health < -200) {
           guardian_dead(ent, context.entities);
           context.entities.free(ent);
           return;
      }

      M_SetAnimation(ent, guardian_move_death, context.entities);
  };

  self.monsterinfo.stand = guardian_stand;
  self.monsterinfo.walk = guardian_walk;
  self.monsterinfo.run = guardian_run;
  self.monsterinfo.attack = guardian_attack;
  self.monsterinfo.melee_debounce_time = 0;

  context.entities.linkentity(self);

  M_SetAnimation(self, guardian_move_stand, context.entities);

  self.think = monster_think;
  self.nextthink = context.entities.timeSeconds + MONSTER_TICK;
}

export function registerGuardianSpawns(registry: SpawnRegistry): void {
  registry.register('monster_guardian', SP_monster_guardian);
}
