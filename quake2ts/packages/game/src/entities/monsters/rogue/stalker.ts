import {
  Entity,
  MonsterMove,
  MonsterFrame,
  MoveType,
  Solid,
  DeadFlag,
  EntityFlags,
  AiFlags
} from '../../entity.js';
import {
  ai_stand,
  ai_move,
  ai_walk,
  ai_run,
  ai_charge,
  monster_think,
  PredictAim,
  M_CalculatePitchToFire,
  blocked_checkjump,
  blocked_checkplat,
  BlockedJumpResult
} from '../../../ai/index.js';
import {
  Vec3,
  ZERO_VEC3,
  addVec3,
  scaleVec3,
  subtractVec3,
  normalizeVec3,
  vectorToAngles,
  angleVectors,
  lengthVec3,
  copyVec3,
  MASK_MONSTERSOLID,
  CONTENTS_SOLID,
  MASK_WATER,
  MASK_PROJECTILE,
  DEG2RAD,
  MASK_SHOT,
  SoundChannel,
  ATTN_NORM,
  ATTN_IDLE,
  ATTN_NONE,
  ServerCommand,
  dotVec3
} from '@quake2ts/shared';
import { EntitySystem } from '../../system.js';
import {
  M_SetAnimation,
  M_ShouldReactToPain,
  M_CheckGib,
  M_AllowSpawn,
  walkmonster_start,
  M_ProjectFlashSource,
  M_MonsterDodge,
  createMonsterSpawn
} from '../common.js';
import { monster_fire_blaster } from '../attack.js';
import { throwGibs, GibType } from '../../gibs.js';
import { DamageMod } from '../../../combat/damageMods.js';
import { SpawnContext, SpawnRegistry } from '../../spawn.js';
import { visible, infront } from '../../../ai/perception.js';
import { MulticastType } from '../../../imports.js';

// --- STUBS and HELPERS ---

const MONSTER_TICK = 0.1;

// Wrapper for random functions since they are not directly exported
function crandom(): number {
  return 2.0 * (Math.random() - 0.5);
}

function random_time(min: number, max: number): number {
    return min + Math.random() * (max - min);
}

function has_valid_enemy(self: Entity): boolean {
    return self.enemy !== null && self.enemy.health > 0;
}

function monster_footstep(self: Entity, context: EntitySystem): void {
  // Can be implemented if sound effects are needed
}

function fire_hit(self: Entity, aim: Vec3, damage: number, kick: number, context: EntitySystem): boolean {
     if (!self.enemy) return false;

    const { forward } = angleVectors(self.angles);
    const start = { ...self.origin };
    start.z += self.viewheight;

    const end = addVec3(start, scaleVec3(forward, aim.x));

    const tr = context.trace(start, null, null, end, self, MASK_SHOT);

    if (tr.ent === self.enemy || (tr.ent && tr.ent.takedamage)) {
        return true;
    }
    return false;
}

// --- AI WRAPPERS ---

function stalker_ai_stand(self: Entity, dist: number, context: EntitySystem): void {
    ai_stand(self, MONSTER_TICK, context);
}

function stalker_ai_run(self: Entity, dist: number, context: EntitySystem): void {
    ai_run(self, dist, MONSTER_TICK, context);
}

function stalker_ai_walk(self: Entity, dist: number, context: EntitySystem): void {
    ai_walk(self, dist, MONSTER_TICK, context);
}

function stalker_ai_charge(self: Entity, dist: number, context: EntitySystem): void {
    ai_charge(self, dist, MONSTER_TICK, context);
}

function stalker_ai_move(self: Entity, dist: number, context: EntitySystem): void {
    ai_move(self, dist);
}

// --- CONSTANTS ---
const MELEE_DISTANCE = 60;

const SPAWNFLAG_STALKER_ONROOF = 8;
const SPAWNFLAG_STALKER_NOJUMPING = 16;

const SOUND_PAIN = 'stalker/pain.wav';
const SOUND_DIE = 'stalker/death.wav';
const SOUND_SIGHT = 'stalker/sight.wav';
const SOUND_PUNCH_HIT1 = 'stalker/melee1.wav';
const SOUND_PUNCH_HIT2 = 'stalker/melee2.wav';
const SOUND_IDLE = 'stalker/idle.wav';

// Forward declarations
let stalker_move_stand: MonsterMove;
let stalker_move_run: MonsterMove;
let stalker_move_pain: MonsterMove;
let stalker_move_death: MonsterMove;
let stalker_move_idle: MonsterMove;
let stalker_move_idle2: MonsterMove;
let stalker_move_walk: MonsterMove;
let stalker_move_false_death: MonsterMove;
let stalker_move_false_death_start: MonsterMove;
let stalker_move_false_death_end: MonsterMove;
let stalker_move_shoot: MonsterMove;
let stalker_move_swing_l: MonsterMove;
let stalker_move_swing_r: MonsterMove;
let stalker_move_jump_up: MonsterMove;
let stalker_move_jump_down: MonsterMove;
let stalker_move_jump_straightup: MonsterMove;


function stalker_idle_noise(self: Entity, context: EntitySystem) {
  context.sound(self, SoundChannel.Voice, SOUND_IDLE, 0.5, ATTN_IDLE, 0);
}

function stalker_stand(self: Entity, context: EntitySystem): void {
   if (Math.random() < 0.25)
        M_SetAnimation(self, stalker_move_stand, context);
    else
        M_SetAnimation(self, stalker_move_idle2, context);
}

const stalker_frames_idle: MonsterFrame[] = [
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0, think: stalker_idle_noise },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 }
];
stalker_move_idle = {
    firstframe: 0,
    lastframe: 20,
    frames: stalker_frames_idle,
    endfunc: stalker_stand
};

const stalker_frames_idle2: MonsterFrame[] = [
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 }
];
stalker_move_idle2 = {
    firstframe: 21,
    lastframe: 33,
    frames: stalker_frames_idle2,
    endfunc: stalker_stand
};

function stalker_idle(self: Entity, context: EntitySystem): void {
    if (Math.random() < 0.35)
        M_SetAnimation(self, stalker_move_idle, context);
    else
        M_SetAnimation(self, stalker_move_idle2, context);
}


const stalker_frames_stand: MonsterFrame[] = [
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0, think: stalker_idle_noise },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 },
    { ai: stalker_ai_stand, dist: 0 }
];
stalker_move_stand = {
    firstframe: 0,
    lastframe: 20,
    frames: stalker_frames_stand,
    endfunc: stalker_stand
};

// RUN
const stalker_frames_run: MonsterFrame[] = [
    { ai: stalker_ai_run, dist: 13, think: monster_footstep },
    { ai: stalker_ai_run, dist: 17 },
    { ai: stalker_ai_run, dist: 21, think: monster_footstep },
    { ai: stalker_ai_run, dist: 18 }
];
stalker_move_run = {
    firstframe: 34,
    lastframe: 37,
    frames: stalker_frames_run,
    endfunc: null
};

function stalker_run(self: Entity, context: EntitySystem): void {
    if (self.monsterinfo.aiflags & AiFlags.StandGround)
        M_SetAnimation(self, stalker_move_stand, context);
    else
        M_SetAnimation(self, stalker_move_run, context);
}

// WALK
function stalker_walk(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, stalker_move_walk, context);
}

const stalker_frames_walk: MonsterFrame[] = [
    { ai: stalker_ai_walk, dist: 4, think: monster_footstep },
    { ai: stalker_ai_walk, dist: 6 },
    { ai: stalker_ai_walk, dist: 8 },
    { ai: stalker_ai_walk, dist: 5 },
    { ai: stalker_ai_walk, dist: 4, think: monster_footstep },
    { ai: stalker_ai_walk, dist: 6 },
    { ai: stalker_ai_walk, dist: 8 },
    { ai: stalker_ai_walk, dist: 4 }
];
stalker_move_walk = {
    firstframe: 38,
    lastframe: 45,
    frames: stalker_frames_walk,
    endfunc: stalker_walk
};

// False Death / Reactivate

function stalker_reactivate(self: Entity, context: EntitySystem): void {
    self.monsterinfo.aiflags &= ~AiFlags.StandGround;
    M_SetAnimation(self, stalker_move_false_death_end, context);
}

function stalker_heal(self: Entity, context: EntitySystem): void {
    self.health++;

    if (self.monsterinfo.setskin) self.monsterinfo.setskin(self);

    if (self.health >= self.max_health) {
        self.health = self.max_health;
        stalker_reactivate(self, context);
    }
}

function stalker_false_death(self: Entity, context: EntitySystem): void {
    M_SetAnimation(self, stalker_move_false_death, context);
}

const stalker_frames_reactivate: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0, think: monster_footstep }
];
stalker_move_false_death_end = {
    firstframe: 46,
    lastframe: 49,
    frames: stalker_frames_reactivate,
    endfunc: stalker_run
};

const stalker_frames_false_death: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal },
    { ai: stalker_ai_move, dist: 0, think: stalker_heal }
];
stalker_move_false_death = {
    firstframe: 50,
    lastframe: 59,
    frames: stalker_frames_false_death,
    endfunc: stalker_false_death
};

const stalker_frames_false_death_start: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 }
];
stalker_move_false_death_start = {
    firstframe: 60,
    lastframe: 68,
    frames: stalker_frames_false_death_start,
    endfunc: stalker_false_death
};

function stalker_false_death_start_func(self: Entity, context: EntitySystem): void {
    const newAngles = { ...self.angles };
    newAngles.z = 0;
    self.angles = newAngles;

    self.monsterinfo.aiflags |= AiFlags.StandGround;
    M_SetAnimation(self, stalker_move_false_death_start, context);
}

// PAIN
const stalker_frames_pain: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: 0 }
];
stalker_move_pain = {
    firstframe: 69,
    lastframe: 72,
    frames: stalker_frames_pain,
    endfunc: stalker_run
};

function stalker_pain(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
    if (self.deadflag) return;
    if (!self.groundentity) return;

     if (self.monsterinfo.current_move === stalker_move_false_death_end ||
        self.monsterinfo.current_move === stalker_move_false_death_start)
        return;

    if (self.monsterinfo.current_move === stalker_move_false_death) {
        return;
    }

    context.engine.sound?.(self, 0, SOUND_PAIN, 1, ATTN_NORM, 0);

    if (M_ShouldReactToPain(self, context)) {
        self.monsterinfo.current_move = stalker_move_pain;
    }
}

function stalker_setskin(self: Entity): void {
    if (self.health < (self.max_health / 2))
        self.skin = 1;
    else
        self.skin = 0;
}


// ATTACK

function stalker_jump_straightup(self: Entity, context: EntitySystem): void {
     if (self.deadflag) return;
     // Implement if jump straight up logic needed
}

function stalker_jump_wait_land(self: Entity, context: EntitySystem): void {
    // Implement if needed
}

function stalker_do_pounce(self: Entity, dest: Vec3): boolean {
    return false;
}

function stalker_shoot_attack(self: Entity, context: EntitySystem): void {
    if (!has_valid_enemy(self)) return;

    const { forward, right } = angleVectors(self.angles);
    const offset = { x: 24, y: 0, z: 6 };
    const start = M_ProjectFlashSource(self, offset, forward, right);

    if (self.enemy) {
        // Adopt shared PredictAim
        const boltSpeed = 800;
        const { aimdir } = PredictAim(context, self, self.enemy, start, boltSpeed, false, 0);

        monster_fire_blaster(self, start, aimdir, 5, boltSpeed, 0, 0, context, DamageMod.BLASTER);
    }
}

function stalker_shoot_attack2(self: Entity, context: EntitySystem): void {
    if (Math.random() < 0.5)
        stalker_shoot_attack(self, context);
}

const stalker_frames_shoot: MonsterFrame[] = [
    { ai: stalker_ai_charge, dist: 13 },
    { ai: stalker_ai_charge, dist: 17, think: stalker_shoot_attack },
    { ai: stalker_ai_charge, dist: 21 },
    { ai: stalker_ai_charge, dist: 18, think: stalker_shoot_attack2 }
];
stalker_move_shoot = {
    firstframe: 34,
    lastframe: 37,
    frames: stalker_frames_shoot,
    endfunc: stalker_run
};

function stalker_attack_ranged(self: Entity, context: EntitySystem): void {
    if (!has_valid_enemy(self)) return;
    M_SetAnimation(self, stalker_move_shoot, context);
}


// MELEE

function stalker_swing_attack(self: Entity, context: EntitySystem): void {
    const aim = { x: MELEE_DISTANCE, y: 0, z: 0 };
    if (fire_hit(self, aim, 10, 50, context)) {
        context.sound(self, SoundChannel.Weapon, SOUND_PUNCH_HIT1, 1, ATTN_NORM, 0);
    }
}

const stalker_frames_swing_l: MonsterFrame[] = [
    { ai: stalker_ai_charge, dist: 2 },
    { ai: stalker_ai_charge, dist: 4 },
    { ai: stalker_ai_charge, dist: 6 },
    { ai: stalker_ai_charge, dist: 10, think: monster_footstep },
    { ai: stalker_ai_charge, dist: 5, think: stalker_swing_attack },
    { ai: stalker_ai_charge, dist: 5 },
    { ai: stalker_ai_charge, dist: 5 },
    { ai: stalker_ai_charge, dist: 5, think: monster_footstep }
];
stalker_move_swing_l = {
    firstframe: 73,
    lastframe: 80,
    frames: stalker_frames_swing_l,
    endfunc: stalker_run
};

const stalker_frames_swing_r: MonsterFrame[] = [
    { ai: stalker_ai_charge, dist: 4 },
    { ai: stalker_ai_charge, dist: 6, think: monster_footstep },
    { ai: stalker_ai_charge, dist: 6, think: stalker_swing_attack },
    { ai: stalker_ai_charge, dist: 10 },
    { ai: stalker_ai_charge, dist: 5, think: monster_footstep }
];
stalker_move_swing_r = {
    firstframe: 81,
    lastframe: 85,
    frames: stalker_frames_swing_r,
    endfunc: stalker_run
};

function stalker_attack_melee(self: Entity, context: EntitySystem): void {
    if (!has_valid_enemy(self)) return;
    if (Math.random() < 0.5)
        M_SetAnimation(self, stalker_move_swing_l, context);
    else
        M_SetAnimation(self, stalker_move_swing_r, context);
}

// SIGHT
function stalker_sight(self: Entity, enemy: Entity): void {
}

// DODGE

const stalker_frames_jump_straightup: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 1, think: stalker_jump_straightup },
    { ai: stalker_ai_move, dist: 1, think: stalker_jump_wait_land },
    { ai: stalker_ai_move, dist: -1, think: monster_footstep },
    { ai: stalker_ai_move, dist: -1 }
];
stalker_move_jump_straightup = {
    firstframe: 86,
    lastframe: 89,
    frames: stalker_frames_jump_straightup,
    endfunc: stalker_run
};

const stalker_frames_jump_up: MonsterFrame[] = [
  { ai: stalker_ai_move, dist: 0 }, // JUMP_UP
  // Frames to animate jump...
  // Stub for now, using stand as placeholder or similar
];
stalker_move_jump_up = {
  firstframe: 86, lastframe: 89, frames: stalker_frames_jump_straightup, endfunc: stalker_run // Reuse straightup for now
};

const stalker_frames_jump_down: MonsterFrame[] = [
  { ai: stalker_ai_move, dist: 0 }, // JUMP_DOWN
];
stalker_move_jump_down = {
  firstframe: 86, lastframe: 89, frames: stalker_frames_jump_straightup, endfunc: stalker_run // Reuse
};


function stalker_dodge(self: Entity, attacker: Entity, eta: number): void {
    if (self.spawnflags & SPAWNFLAG_STALKER_NOJUMPING) return;
    // Basic dodge implementation or call shared
}


// BLOCKED
function stalker_blocked(self: Entity, dist: number, context: EntitySystem): void {
    if (!context) return;
    if (blocked_checkplat(context, self, 10)) return;

    if (self.spawnflags & SPAWNFLAG_STALKER_NOJUMPING) return;

    const result = blocked_checkjump(context, self, 10);

    if (result === BlockedJumpResult.JUMP_JUMP_UP) {
        M_SetAnimation(self, stalker_move_jump_up, context);
    } else if (result === BlockedJumpResult.JUMP_JUMP_DOWN) {
         M_SetAnimation(self, stalker_move_jump_down, context);
    }
}

// DEATH

function stalker_dead(self: Entity, context: EntitySystem): void {
    self.mins = { x: -28, y: -28, z: -18 };
    self.maxs = { x: 28, y: 28, z: -4 };
}

const stalker_frames_death: MonsterFrame[] = [
    { ai: stalker_ai_move, dist: 0 },
    { ai: stalker_ai_move, dist: -5 },
    { ai: stalker_ai_move, dist: -10 },
    { ai: stalker_ai_move, dist: -20 },
    { ai: stalker_ai_move, dist: -10 },
    { ai: stalker_ai_move, dist: -10 },
    { ai: stalker_ai_move, dist: -5 },
    { ai: stalker_ai_move, dist: -5 },
    { ai: stalker_ai_move, dist: 0, think: monster_footstep }
];
stalker_move_death = {
    firstframe: 90,
    lastframe: 98,
    frames: stalker_frames_death,
    endfunc: stalker_dead
};

function stalker_die(
  self: Entity,
  inflictor: Entity | null,
  attacker: Entity | null,
  damage: number,
  point: Vec3,
  mod: DamageMod
): void {
  self.movetype = MoveType.Toss;

  const newAngles = { ...self.angles };
  newAngles.z = 0;
  self.angles = newAngles;

  self.deadflag = DeadFlag.Dead;
  self.takedamage = true;
  self.monsterinfo.current_move = stalker_move_death;
}

// SPAWN

export function registerStalkerSpawns(registry: SpawnRegistry): void {
  registry.register('monster_stalker', SP_monster_stalker);
}

export function SP_monster_stalker(self: Entity, context: SpawnContext): void {
    if (!M_AllowSpawn(self, context)) {
        context.entities.free(self);
        return;
    }

    context.entities.soundIndex(SOUND_PAIN);
    context.entities.soundIndex(SOUND_DIE);
    context.entities.soundIndex(SOUND_SIGHT);
    context.entities.soundIndex(SOUND_PUNCH_HIT1);
    context.entities.soundIndex(SOUND_PUNCH_HIT2);
    context.entities.soundIndex(SOUND_IDLE);

    context.entities.modelIndex("models/objects/laser/tris.md2");

    self.modelindex = context.entities.modelIndex("models/monsters/stalker/tris.md2");

    self.mins = { x: -28, y: -28, z: -18 };
    self.maxs = { x: 28, y: 28, z: 18 };
    self.movetype = MoveType.Step;
    self.solid = Solid.BoundingBox;

    self.health = 250 * context.health_multiplier;
    self.max_health = self.health;
    self.mass = 250;

    self.pain = (ent, other, kick, damage) => stalker_pain(ent, other, kick, damage, context.entities);
    self.die = stalker_die;

    self.monsterinfo.stand = stalker_stand;
    self.monsterinfo.walk = stalker_walk;
    self.monsterinfo.run = stalker_run;
    self.monsterinfo.attack = stalker_attack_ranged;
    self.monsterinfo.sight = stalker_sight;
    self.monsterinfo.idle = stalker_idle;
    self.monsterinfo.dodge = stalker_dodge;
    self.monsterinfo.blocked = (s, d) => stalker_blocked(s, d, context.entities);
    self.monsterinfo.melee = stalker_attack_melee;
    self.monsterinfo.setskin = stalker_setskin;

    // Set Rogue/Mission Pack specific jump/drop heights
    self.monsterinfo.jump_height = 48;
    self.monsterinfo.drop_height = 300;
    self.monsterinfo.can_jump = true;

    context.entities.linkentity(self);

    M_SetAnimation(self, stalker_move_stand, context.entities);

    if (self.spawnflags & SPAWNFLAG_STALKER_ONROOF) {
        const newAngles = { ...self.angles };
        newAngles.z = 180;
        self.angles = newAngles;
    }

    walkmonster_start(self, context.entities);
}
