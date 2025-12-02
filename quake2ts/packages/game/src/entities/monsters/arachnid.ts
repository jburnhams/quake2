import {
  SoundIndex,
  ModelIndex,
  MoveType,
  Solid,
  EntityFlags,
  Trace,
  DamageMod,
  Channel,
  Attenuation,
  Vec3,
  ServerCommand
} from '@quake2ts/shared';
import {
  Entity,
  MonsterInfo,
  MonsterMove,
  MonsterFrame,
  EntitySystem,
  GameExports,
  GameImports,
  DeadFlag
} from '../../index.js';
import {
  ai_stand,
  ai_walk,
  ai_run,
  ai_move,
  ai_charge
} from '../../ai/index.js';
import {
  rangeTo,
  visible,
  infront
} from '../../ai/perception.js';
import {
  M_SetAnimation,
  M_ShouldReactToPain,
  M_CheckGib,
  M_AllowSpawn,
  walkmonster_start,
  M_ProjectFlashSource
} from './common.js';
import {
  throwGibs
} from '../gibs.js';
import {
  monster_fire_railgun,
  monster_fire_hit
} from './attack.js';
import { angleVectors, subtractVec3, normalizeVec3 } from '@quake2ts/shared';

// Frames
const FRAME_rails1 = 0;
const FRAME_rails2 = 1;
const FRAME_rails3 = 2;
const FRAME_rails4 = 3;
const FRAME_rails5 = 4;
const FRAME_rails6 = 5;
const FRAME_rails7 = 6;
const FRAME_rails8 = 7;
const FRAME_rails9 = 8;
const FRAME_rails10 = 9;
const FRAME_rails11 = 10;
const FRAME_death1 = 11;
const FRAME_death20 = 30;
const FRAME_melee_atk1 = 31;
const FRAME_melee_atk12 = 42;
const FRAME_pain11 = 43;
const FRAME_pain15 = 47;
const FRAME_idle1 = 48;
const FRAME_idle13 = 60;
const FRAME_walk1 = 61;
const FRAME_walk10 = 70;
const FRAME_pain21 = 76;
const FRAME_pain26 = 81;
const FRAME_rails_up1 = 98;
const FRAME_rails_up7 = 104;
const FRAME_rails_up11 = 108;
const FRAME_rails_up16 = 113;

const MODEL_SCALE = 1.0;
const MELEE_DISTANCE = 64;

// Sound Channels
const CHAN_AUTO = 0;
const CHAN_WEAPON = 1;
const CHAN_VOICE = 2;
const CHAN_ITEM = 3;
const CHAN_BODY = 4;

// Muzzle Flash IDs - Placeholder values as I don't have m_flash.h
// Assuming sequential indices or similar to other monsters
const MZ2_ARACHNID_RAIL1 = 20;
const MZ2_ARACHNID_RAIL2 = 21;
const MZ2_ARACHNID_RAIL_UP1 = 22;
const MZ2_ARACHNID_RAIL_UP2 = 23;

// Sounds
let sound_pain: string;
let sound_death: string;
let sound_sight: string;
let sound_step: string;
let sound_charge: string;
let sound_melee: string;
let sound_melee_hit: string;

// Stand
const arachnid_frames_stand: MonsterFrame[] = [
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 },
  { ai: ai_stand, dist: 0 }
];
const arachnid_move_stand: MonsterMove = {
  firstframe: FRAME_idle1,
  lastframe: FRAME_idle13,
  frames: arachnid_frames_stand,
  endfunc: undefined
};

function arachnid_stand(self: Entity, context: EntitySystem) {
  M_SetAnimation(self, arachnid_move_stand, context);
}

// Walk
function arachnid_footstep(self: Entity, context: EntitySystem) {
  context.engine.sound?.(self, CHAN_BODY, sound_step, 0.5, Attenuation.Idle, 0);
}

const arachnid_frames_walk: MonsterFrame[] = [
  { ai: ai_walk, dist: 8, func: arachnid_footstep },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8, func: arachnid_footstep },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 },
  { ai: ai_walk, dist: 8 }
];
const arachnid_move_walk: MonsterMove = {
  firstframe: FRAME_walk1,
  lastframe: FRAME_walk10,
  frames: arachnid_frames_walk,
  endfunc: undefined
};

function arachnid_walk(self: Entity, context: EntitySystem) {
  M_SetAnimation(self, arachnid_move_walk, context);
}

// Run
const arachnid_frames_run: MonsterFrame[] = [
  { ai: ai_run, dist: 8, func: arachnid_footstep },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8, func: arachnid_footstep },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 },
  { ai: ai_run, dist: 8 }
];
const arachnid_move_run: MonsterMove = {
  firstframe: FRAME_walk1,
  lastframe: FRAME_walk10,
  frames: arachnid_frames_run,
  endfunc: undefined
};

function arachnid_run(self: Entity, context: EntitySystem) {
  M_SetAnimation(self, arachnid_move_run, context);
}

// Pain
const arachnid_frames_pain1: MonsterFrame[] = [
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 }
];
const arachnid_move_pain1: MonsterMove = {
  firstframe: FRAME_pain11,
  lastframe: FRAME_pain15,
  frames: arachnid_frames_pain1,
  endfunc: arachnid_run
};

const arachnid_frames_pain2: MonsterFrame[] = [
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 }
];
const arachnid_move_pain2: MonsterMove = {
  firstframe: FRAME_pain21,
  lastframe: FRAME_pain26,
  frames: arachnid_frames_pain2,
  endfunc: arachnid_run
};

function arachnid_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem) {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  }

  if (context.timeSeconds < self.pain_debounce_time) {
    return;
  }

  self.pain_debounce_time = context.timeSeconds + 3;
  context.engine.sound?.(self, CHAN_VOICE, sound_pain, 1, Attenuation.Norm, 0);

  if (!M_ShouldReactToPain(self)) {
    return;
  }

  if (Math.random() < 0.5) {
    M_SetAnimation(self, arachnid_move_pain1, context);
  } else {
    M_SetAnimation(self, arachnid_move_pain2, context);
  }
}

// Attack
function arachnid_charge_rail(self: Entity, context: EntitySystem) {
  if (!self.enemy || !self.enemy.inUse) {
    return;
  }

  context.engine.sound?.(self, CHAN_WEAPON, sound_charge, 1, Attenuation.Norm, 0);

  // self.pos1 is used to store target position
  self.pos1 = { ...self.enemy.origin };
  self.pos1 = { ...self.pos1, z: self.pos1.z + self.enemy.viewheight };
}

function arachnid_rail(self: Entity, context: EntitySystem) {
  let id: number;
  switch (self.frame) {
    case FRAME_rails4:
    default:
      id = MZ2_ARACHNID_RAIL1;
      break;
    case FRAME_rails8:
      id = MZ2_ARACHNID_RAIL2;
      break;
    case FRAME_rails_up7:
      id = MZ2_ARACHNID_RAIL_UP1;
      break;
    case FRAME_rails_up11:
      id = MZ2_ARACHNID_RAIL_UP2;
      break;
  }

  const { forward, right } = angleVectors(self.angles);

  const start = M_ProjectFlashSource(self, {x: 0, y: 0, z: 0}, forward, right);

  const dir = subtractVec3(self.pos1, start);
  normalizeVec3(dir);

  monster_fire_railgun(self, start, dir, 35, 100, id, context);
}

const arachnid_frames_attack1: MonsterFrame[] = [
  { ai: ai_charge, dist: 0, func: arachnid_charge_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_rail },
  { ai: ai_charge, dist: 0, func: arachnid_charge_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 }
];
const arachnid_attack1: MonsterMove = {
  firstframe: FRAME_rails1,
  lastframe: FRAME_rails11,
  frames: arachnid_frames_attack1,
  endfunc: arachnid_run
};

const arachnid_frames_attack_up1: MonsterFrame[] = [
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_charge_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_rail },
  { ai: ai_charge, dist: 0, func: arachnid_charge_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_rail },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 }
];
const arachnid_attack_up1: MonsterMove = {
  firstframe: FRAME_rails_up1,
  lastframe: FRAME_rails_up16,
  frames: arachnid_frames_attack_up1,
  endfunc: arachnid_run
};

function arachnid_melee_charge(self: Entity, context: EntitySystem) {
  context.engine.sound?.(self, CHAN_WEAPON, sound_melee, 1, Attenuation.Norm, 0);
}

function arachnid_melee_hit(self: Entity, context: EntitySystem) {
  if (!monster_fire_hit(self, {x: MELEE_DISTANCE, y: 0, z: 0}, 15, 50, context)) {
    // missed
  }
}

const arachnid_frames_melee: MonsterFrame[] = [
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_melee_charge },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_melee_hit },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_melee_charge },
  { ai: ai_charge, dist: 0 },
  { ai: ai_charge, dist: 0, func: arachnid_melee_hit },
  { ai: ai_charge, dist: 0 }
];
const arachnid_melee: MonsterMove = {
  firstframe: FRAME_melee_atk1,
  lastframe: FRAME_melee_atk12,
  frames: arachnid_frames_melee,
  endfunc: arachnid_run
};

function arachnid_attack(self: Entity, context: EntitySystem) {
  if (!self.enemy || !self.enemy.inUse) {
    return;
  }

  // Check melee range
  const range = rangeTo(self, self.enemy);

  if (range < MELEE_DISTANCE) {
    M_SetAnimation(self, arachnid_melee, context);
  } else if ((self.enemy.origin.z - self.origin.z) > 150) {
    M_SetAnimation(self, arachnid_attack_up1, context);
  } else {
    M_SetAnimation(self, arachnid_attack1, context);
  }
}

// Death
function arachnid_dead(self: Entity, context: EntitySystem) {
  self.mins = {x: -16, y: -16, z: -24};
  self.maxs = {x: 16, y: 16, z: -8};
  self.movetype = MoveType.Toss;
  self.svflags |= 0x20000000; // DeadMonster

  self.nextthink = 0;
  context.linkentity(self);
}

const arachnid_frames_death1: MonsterFrame[] = [
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: -1.23 },
  { ai: ai_move, dist: -1.23 },
  { ai: ai_move, dist: -1.23 },
  { ai: ai_move, dist: -1.23 },
  { ai: ai_move, dist: -1.64 },
  { ai: ai_move, dist: -1.64 },
  { ai: ai_move, dist: -2.45 },
  { ai: ai_move, dist: -8.63 },
  { ai: ai_move, dist: -4.0 },
  { ai: ai_move, dist: -4.5 },
  { ai: ai_move, dist: -6.8 },
  { ai: ai_move, dist: -8.0 },
  { ai: ai_move, dist: -5.4 },
  { ai: ai_move, dist: -3.4 },
  { ai: ai_move, dist: -1.9 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 },
  { ai: ai_move, dist: 0 }
];
const arachnid_move_death: MonsterMove = {
  firstframe: FRAME_death1,
  lastframe: FRAME_death20,
  frames: arachnid_frames_death1,
  endfunc: arachnid_dead
};

function arachnid_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod, context: EntitySystem) {
  if (M_CheckGib(self, context)) {
    context.engine.sound?.(self, CHAN_VOICE, 'misc/udeath.wav', 1, Attenuation.Norm, 0);
    throwGibs(context, self.origin, damage); // throwGibs accepts EntitySystem
    self.deadflag = DeadFlag.Dead;
    return;
  }

  if (self.deadflag === DeadFlag.Dead) {
    return;
  }

  context.engine.sound?.(self, CHAN_VOICE, sound_death, 1, Attenuation.Norm, 0);
  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;

  M_SetAnimation(self, arachnid_move_death, context);
}

// Spawn
export function SP_monster_arachnid(self: Entity, context: EntitySystem) {
  if (!M_AllowSpawn(self, context)) {
    context.free(self);
    return;
  }

  self.classname = 'monster_arachnid';

  sound_step = 'insane/insane11.wav';
  sound_charge = 'gladiator/railgun.wav';
  sound_melee = 'gladiator/melee3.wav';
  sound_melee_hit = 'gladiator/melee2.wav';
  sound_pain = 'arachnid/pain.wav';
  sound_death = 'arachnid/death.wav';
  sound_sight = 'arachnid/sight.wav';

  self.model = 'models/monsters/arachnid/tris.md2';
  self.mins = {x: -48, y: -48, z: -20};
  self.maxs = {x: 48, y: 48, z: 48};
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;

  self.health = 1000;
  self.max_health = 1000;

  self.mass = 450;

  self.pain = (e, o, k, d) => arachnid_pain(e, o, k, d, context);
  self.die = (e, i, a, d, p, m) => arachnid_die(e, i, a, d, p, m, context);

  self.monsterinfo = {
    ...self.monsterinfo,
    stand: arachnid_stand,
    walk: arachnid_walk,
    run: arachnid_run,
    attack: arachnid_attack,
    sight: (e, o) => context.engine.sound?.(e, CHAN_VOICE, sound_sight, 1, Attenuation.Norm, 0),
    scale: MODEL_SCALE,
    aiflags: self.monsterinfo?.aiflags || 0
  };

  context.linkentity(self);
  M_SetAnimation(self, arachnid_move_stand, context);
  walkmonster_start(self, context);
}

export function registerArachnidSpawns(registry: any): void {
  registry.register('monster_arachnid', SP_monster_arachnid);
}
