import {
  Entity,
  MonsterMove,
  MonsterFrame,
  MoveType,
  Solid,
  DeadFlag,
  EntityFlags,
  AiFlags,
  ReinforcementList
} from '../../entity.js';
import {
  ai_stand,
  ai_move,
  ai_walk,
  ai_run,
  ai_charge,
  monster_think,
  PredictAim,
} from '../../../ai/index.js';
import {
  Vec3,
  SoundChannel,
  ATTN_NORM,
  ATTN_IDLE,
  ATTN_NONE,
  angleVectors,
  lengthVec3,
  subtractVec3,
  MASK_SHOT,
  DEG2RAD,
  addVec3,
  scaleVec3
} from '@quake2ts/shared';
import { EntitySystem } from '../../system.js';
import {
  M_SetAnimation,
  M_ShouldReactToPain,
  M_AllowSpawn,
  walkmonster_start,
  M_ProjectFlashSource,
  createMonsterSpawn
} from '../common.js';
import { DamageMod } from '../../../combat/damageMods.js';
import { SpawnContext, SpawnRegistry } from '../../spawn.js';
import { rangeTo, visible } from '../../../ai/perception.js';
import { monster_fire_blaster, monster_fire_railgun } from '../attack.js';

// Constants
const MODEL_SCALE = 1.0;
const MONSTER_TICK = 0.1;
const RANGE_MELEE = 100;

const SOUND_PAIN1 = 'widow/pain1.wav';
const SOUND_PAIN2 = 'widow/pain2.wav';
const SOUND_PAIN3 = 'widow/pain3.wav';
const SOUND_DEATH = 'widow/death.wav';
const SOUND_RAIL = 'gladiator/railgun.wav';
const SOUND_BLASTER = 'tank/rocket.wav';
const SOUND_KICK = 'widow/kick.wav';
const SOUND_SIGHT = 'widow/sight.wav';

// Local Helpers

function frandom(context: EntitySystem): number {
    return context.rng.frandom();
}

function M_SlotsLeft(self: Entity): number {
    return self.monsterinfo.monster_slots || 0;
}

function M_SetupReinforcementsWithContext(
  config: string,
  list: ReinforcementList,
  context: EntitySystem
): void {
  const parts = config.split(';');
  for (const part of parts) {
    const [classname, countStr] = part.trim().split(' ');
    const count = parseInt(countStr, 10);
    list.push({
      classname,
      strength: count,
      mins: { x: -28, y: -28, z: -18 },
      maxs: { x: 28, y: 28, z: 18 }
    });
  }
}

function M_CheckAttack_Base(
  self: Entity,
  context: EntitySystem,
  chance_range_melee: number,
  chance_range_near: number,
  chance_range_mid: number,
  chance_range_far: number,
  chance_prediction: number,
  min_range_attack_dist: number
): boolean {
    if (!self.enemy) return false;

    // Check range
    const dist = rangeTo(self, self.enemy);

    if (dist < RANGE_MELEE) {
        if (frandom(context) < chance_range_melee) {
             self.monsterinfo.attack_state = 4; // AS_MISSILE
             return true;
        }
    }

    if (frandom(context) < chance_range_mid) {
         self.monsterinfo.attack_state = 4;
         return true;
    }

    return false;
}

// Forward Declarations
let widow_move_stand: MonsterMove;
let widow_move_walk: MonsterMove;
let widow_move_run: MonsterMove;
let widow_move_attack_pre_rail: MonsterMove;
let widow_move_attack_rail: MonsterMove;
let widow_move_attack_rail_r: MonsterMove;
let widow_move_attack_rail_l: MonsterMove;
let widow_move_attack_pre_blaster: MonsterMove;
let widow_move_attack_blaster: MonsterMove;
let widow_move_attack_post_blaster: MonsterMove;
let widow_move_attack_post_blaster_r: MonsterMove;
let widow_move_attack_post_blaster_l: MonsterMove;
let widow_move_attack_kick: MonsterMove;
let widow_move_pain_light: MonsterMove;
let widow_move_pain_heavy: MonsterMove;
let widow_move_death: MonsterMove;
let widow_move_spawn: MonsterMove;

// AI Wrappers
function widow_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
    ai_stand(self, dist, context);
}

function widow_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
    ai_walk(self, dist, context);
}

function widow_ai_run(self: Entity, dist: number, context: EntitySystem): void {
    ai_run(self, dist, context);
}

function widow_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
    ai_charge(self, dist, context);
}

function widow_ai_move(self: Entity, dist: number, context: EntitySystem): void {
    ai_move(self, dist);
}


// Actions

function widow_start_blaster(self: Entity, context: EntitySystem): void {
    // Initial setup if needed
}

function widow_reattack_blaster(self: Entity, context: EntitySystem): void {
    if (M_SlotsLeft(self) < 2) {
       // Logic to potentially stop
    }

    // Pass context.trace to visible
    if (self.enemy && visible(self, self.enemy, context.trace)) {
         if (frandom(context) < 0.5) {
             M_SetAnimation(self, widow_move_attack_blaster, context);
         } else {
             M_SetAnimation(self, widow_move_attack_post_blaster, context);
         }
    } else {
        M_SetAnimation(self, widow_move_attack_post_blaster, context);
    }
}


function widow_blaster(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const { forward, right, up } = angleVectors(self.angles);
    const offset = { x: 20, y: 0, z: 30 };
    const start = M_ProjectFlashSource(self, offset, forward, right);

    const dir = subtractVec3(self.enemy.origin, start);
    monster_fire_blaster(self, start, dir, 20, 1000, 0, 0, context, DamageMod.BLASTER);

    context.sound(self, SoundChannel.Weapon, SOUND_BLASTER, 1, ATTN_NORM, 0);
}

function widow_rail(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    const { forward, right } = angleVectors(self.angles);
    const offset = { x: 20, y: 0, z: 30 };
    const start = M_ProjectFlashSource(self, offset, forward, right);

    const dir = subtractVec3(self.enemy.origin, start);
    // Added 0 for flashtype
    monster_fire_railgun(self, start, dir, 50, 100, 0, context);

    context.sound(self, SoundChannel.Weapon, SOUND_RAIL, 1, ATTN_NORM, 0);
}

function widow_kick(self: Entity, context: EntitySystem): void {
    context.sound(self, SoundChannel.Weapon, SOUND_KICK, 1, ATTN_NORM, 0);
}

function widow_spawn_check(self: Entity, context: EntitySystem): void {
    if (M_SlotsLeft(self) > 0) {
        // Spawn logic placeholder
    }
}

// Moves

// STAND
const widow_frames_stand: MonsterFrame[] = Array(20).fill({ ai: widow_ai_stand, dist: 0 });
widow_move_stand = {
  firstframe: 0, // FRAME_stand01
  lastframe: 19, // FRAME_stand20
  frames: widow_frames_stand,
  endfunc: (s, c) => M_SetAnimation(s, widow_move_stand, c)
};

// WALK
const widow_frames_walk: MonsterFrame[] = Array(13).fill({ ai: widow_ai_walk, dist: 10 });
widow_move_walk = {
  firstframe: 20, // FRAME_walk01
  lastframe: 32, // FRAME_walk13
  frames: widow_frames_walk,
  endfunc: (s, c) => M_SetAnimation(s, widow_move_walk, c)
};

// RUN
const widow_frames_run: MonsterFrame[] = Array(8).fill({ ai: widow_ai_run, dist: 10 });
widow_move_run = {
  firstframe: 33, // FRAME_run01
  lastframe: 40, // FRAME_run08
  frames: widow_frames_run,
  endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// SPAWN
const widow_frames_spawn: MonsterFrame[] = Array(18).fill({ ai: widow_ai_charge, dist: 0 });
widow_frames_spawn[8] = { ai: widow_ai_charge, dist: 0, think: widow_spawn_check };
widow_move_spawn = {
    firstframe: 41, // FRAME_spawn01
    lastframe: 58, // FRAME_spawn18
    frames: widow_frames_spawn,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// ATTACK PRE RAIL
const widow_frames_attack_pre_rail: MonsterFrame[] = Array(4).fill({ ai: widow_ai_charge, dist: 0 });
widow_move_attack_pre_rail = {
    firstframe: 59, // FRAME_transc01
    lastframe: 62, // FRAME_transc04
    frames: widow_frames_attack_pre_rail,
    endfunc: null // Transitions to rail
};

// ATTACK RAIL
const widow_frames_attack_rail: MonsterFrame[] = Array(9).fill({ ai: widow_ai_charge, dist: 0 });
widow_frames_attack_rail[2] = { ai: widow_ai_charge, dist: 0, think: widow_rail };
widow_move_attack_rail = {
    firstframe: 63, // FRAME_firea01
    lastframe: 71, // FRAME_firea09
    frames: widow_frames_attack_rail,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// ATTACK PRE BLASTER
const widow_frames_attack_pre_blaster: MonsterFrame[] = Array(3).fill({ ai: widow_ai_charge, dist: 0 });
widow_frames_attack_pre_blaster[0] = { ai: widow_ai_charge, dist: 0, think: widow_start_blaster };
widow_move_attack_pre_blaster = {
    firstframe: 72, // FRAME_fired01
    lastframe: 74, // FRAME_fired02a
    frames: widow_frames_attack_pre_blaster,
    endfunc: null
};

// ATTACK BLASTER
const widow_frames_attack_blaster: MonsterFrame[] = Array(19).fill({ ai: widow_ai_charge, dist: 0, think: widow_blaster });
widow_move_attack_blaster = {
    firstframe: 75,
    lastframe: 93,
    frames: widow_frames_attack_blaster,
    endfunc: widow_reattack_blaster
};

// ATTACK POST BLASTER
const widow_frames_attack_post_blaster: MonsterFrame[] = Array(2).fill({ ai: widow_ai_charge, dist: 0 });
widow_move_attack_post_blaster = {
    firstframe: 94,
    lastframe: 95,
    frames: widow_frames_attack_post_blaster,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// ATTACK KICK
const widow_frames_attack_kick: MonsterFrame[] = Array(8).fill({ ai: widow_ai_charge, dist: 0 });
widow_frames_attack_kick[2] = { ai: widow_ai_charge, dist: 0, think: widow_kick };
widow_move_attack_kick = {
    firstframe: 96,
    lastframe: 103,
    frames: widow_frames_attack_kick,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// PAIN
const widow_frames_pain_heavy: MonsterFrame[] = Array(13).fill({ ai: widow_ai_move, dist: 0 });
widow_move_pain_heavy = {
    firstframe: 104,
    lastframe: 116,
    frames: widow_frames_pain_heavy,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

const widow_frames_pain_light: MonsterFrame[] = Array(3).fill({ ai: widow_ai_move, dist: 0 });
widow_move_pain_light = {
    firstframe: 117,
    lastframe: 119,
    frames: widow_frames_pain_light,
    endfunc: (s, c) => M_SetAnimation(s, widow_move_run, c)
};

// DEATH
const widow_frames_death: MonsterFrame[] = Array(31).fill({ ai: widow_ai_move, dist: 0 });
widow_move_death = {
    firstframe: 120,
    lastframe: 150,
    frames: widow_frames_death,
    endfunc: (s, c) => {
        s.mins = { x: -56, y: -56, z: 0 };
        s.maxs = { x: 56, y: 56, z: 80 };
        s.movetype = MoveType.Toss;
        s.nextthink = -1;
    }
};


// Core Functions

function widow_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
  if (context.timeSeconds < self.pain_debounce_time) return;

  self.pain_debounce_time = context.timeSeconds + 5.0;

  if (damage < 15) context.sound(self, SoundChannel.Voice, SOUND_PAIN1, 1, 1, 0);
  else if (damage < 75) context.sound(self, SoundChannel.Voice, SOUND_PAIN2, 1, 1, 0);
  else context.sound(self, SoundChannel.Voice, SOUND_PAIN3, 1, 1, 0);

  if (!M_ShouldReactToPain(self, context)) return;

  self.monsterinfo.fire_wait = 0;

  if (damage >= 15) {
      if (damage < 75) {
          if (frandom(context) < 0.6) {
              M_SetAnimation(self, widow_move_pain_light, context);
              self.monsterinfo.aiflags &= ~AiFlags.ManualSteering;
          }
      } else {
          if (frandom(context) < 0.75) {
              M_SetAnimation(self, widow_move_pain_heavy, context);
              self.monsterinfo.aiflags &= ~AiFlags.ManualSteering;
          }
      }
  }
}

function widow_die(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: DamageMod, context: EntitySystem): void {
  self.deadflag = DeadFlag.Dead;
  self.takedamage = false;
  self.count = 0;

  M_SetAnimation(self, widow_move_death, context);
}

function widow_checkattack(self: Entity, context: EntitySystem): boolean {
    if (!self.enemy) return false;

    return M_CheckAttack_Base(self, context, 0.4, 0.8, 0.7, 0.6, 0.5, 0);
}

function widow_attack(self: Entity, context: EntitySystem): void {
    if (!self.enemy) return;

    if (M_SlotsLeft(self) >= 2 && frandom(context) < 0.6) {
        M_SetAnimation(self, widow_move_spawn, context);
        return;
    }

    const enemy_range = rangeTo(self, self.enemy);

    if (enemy_range <= RANGE_MELEE) {
        M_SetAnimation(self, widow_move_attack_kick, context);
        return;
    }

    if (frandom(context) < 0.5) {
         M_SetAnimation(self, widow_move_attack_pre_blaster, context);
    } else {
         M_SetAnimation(self, widow_move_attack_pre_rail, context);
    }
}

export function createWidow(self: Entity, context: SpawnContext): void {
    const sys = context.entities;

    if (!M_AllowSpawn(self, sys)) {
        sys.free(self);
        return;
    }

    sys.soundIndex(SOUND_PAIN1);
    sys.soundIndex(SOUND_PAIN2);
    sys.soundIndex(SOUND_PAIN3);
    sys.soundIndex(SOUND_DEATH);
    sys.soundIndex(SOUND_RAIL);
    sys.soundIndex(SOUND_BLASTER);
    sys.soundIndex(SOUND_KICK);
    sys.soundIndex(SOUND_SIGHT);

    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;
    self.modelindex = sys.modelIndex('models/monsters/blackwidow/tris.md2');

    self.mins = { x: -40, y: -40, z: 0 };
    self.maxs = { x: 40, y: 40, z: 144 };

    self.health = (2000 + 1000 * sys.skill) * context.health_multiplier;
    self.mass = 1500;

    self.pain = (e, o, k, d) => widow_pain(e, o, k, d, sys);
    self.die = (e, i, a, d, p, m) => widow_die(e, i, a, d, p, m, sys);

    self.monsterinfo.stand = (e, c) => M_SetAnimation(e, widow_move_stand, c);
    self.monsterinfo.walk = (e, c) => M_SetAnimation(e, widow_move_walk, c);
    self.monsterinfo.run = (e, c) => M_SetAnimation(e, widow_move_run, c);
    self.monsterinfo.attack = widow_attack;
    self.monsterinfo.checkattack = widow_checkattack;

    self.monsterinfo.scale = MODEL_SCALE;
    self.yaw_speed = 30;

    self.flags |= EntityFlags.ImmuneLaser;
    self.monsterinfo.aiflags |= AiFlags.IgnoreShots;

    let slots = 3;
    if (sys.skill === 2) slots = 4;
    else if (sys.skill === 3) slots = 6;
    self.monsterinfo.monster_slots = slots;

    const reinforcements = "monster_stalker 1; monster_flyer 1";
    self.monsterinfo.reinforcements = [];
    M_SetupReinforcementsWithContext(reinforcements, self.monsterinfo.reinforcements, sys);

    sys.linkentity(self);

    M_SetAnimation(self, widow_move_stand, sys);

    walkmonster_start(self, sys);
}

export function registerWidow(registry: SpawnRegistry): void {
  registry.register('monster_widow', createWidow);
}
