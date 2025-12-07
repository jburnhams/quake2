import {
  AngleVectors,
  Entity,
  EntityFlags,
  MoveType,
  SOLID_BBOX,
  Vec3,
  anglemod,
  copyVec3,
  lengthVec3,
  scaleVec3,
  subtractVec3,
  vectoyaw,
  addVec3,
  SoundChannel,
  MathUtils,
  ServerCommand,
  MulticastType,
  normalizeVec3,
  dotProduct,
  setMovedir,
  M_PI,
  toDegrees,
  toRadians,
} from '@quake2ts/shared';
import {
  AIAction,
  AI_ALTERNATE_FLY,
  AI_CHARGING,
  AI_DO_NOT_COUNT,
  AI_HOLD_FRAME,
  AI_IGNORE_SHOTS,
  AI_MANUAL_STEERING,
  AI_SPAWNED_CARRIER,
  AI_STAND_GROUND,
  MonsterMove,
  M_AllowSpawn,
  M_CheckAttack_Base,
  M_ProjectFlashSource,
  M_SetAnimation,
  M_ShouldReactToPain,
  below,
  inback,
  infront,
  visible,
  random_time,
} from '../common.js';
import {
  ModId,
  Mod,
  DamageFlags,
  GibType,
  throwGibs,
  SpawnFlag,
  EntityState,
} from '../../../entity.js';
import { EntitySystem } from '../../../system.js';
import { MuzzleFlash } from '../../../combat/muzzleflash.js';
import { monster_fire_rocket } from '../../attack.js';
import {
  monster_fire_bullet,
  monster_fire_grenade,
  monster_fire_railgun,
  PredictAim,
} from '../../attack.js';
import { ai_run, ai_stand, ai_walk, ai_charge, ai_move } from '../../../ai/movement.js';
import {
  ATTN_NONE,
  ATTN_NORM,
  CHAN_BODY,
  CHAN_VOICE,
  CHAN_WEAPON,
  PRINT_HIGH,
  PRINT_MEDIUM,
} from '../../../constants.js';
import { G_FreeEdict, findSpawnPoint } from '../../../spawn.js';
import { registerMonsterSpawns, registerMonster } from '../../index.js';
import { createFlyer } from '../flyer.js';
// import { createKamikaze } from '../kamikaze.js'; // Mocked or removed for now
import { M_SetupReinforcementsWithContext, M_PickReinforcements, M_SlotsLeft } from './common.js';
import { flymonster_start } from '../../../ai/fly.js';
import { damage } from '../../../combat/damage.js';
import { GameExports } from '../../../game.js';

// Local Random Helpers
const frandom = (min = 0, max = 1): number => min + Math.random() * (max - min);
const crandom = (): number => 2.0 * (Math.random() - 0.5);
const irandom = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

// Constants
const MODEL_SCALE = 1.0;
const CARRIER_ROCKET_TIME = 2.0;
const CARRIER_ROCKET_SPEED = 750;
const RAIL_FIRE_TIME = 3.0;
const DEFAULT_MONSTER_SLOTS_BASE = 3;
const DEFAULT_REINFORCEMENTS = "monster_flyer 1;monster_flyer 1;monster_flyer 1;monster_kamikaze 1";

// Frames
const FRAME_search01 = 0;
const FRAME_search09 = 8;
const FRAME_search13 = 12;

const FRAME_firea01 = 13;
const FRAME_firea08 = 20;
const FRAME_firea09 = 21;
const FRAME_firea11 = 23;
const FRAME_firea12 = 24;
const FRAME_firea15 = 27;

const FRAME_fireb01 = 28;
const FRAME_fireb06 = 33;
const FRAME_fireb07 = 34;
const FRAME_fireb10 = 37;
const FRAME_fireb11 = 38;
const FRAME_fireb16 = 43;

const FRAME_spawn01 = 44;
const FRAME_spawn04 = 47;
const FRAME_spawn08 = 51;
const FRAME_spawn18 = 61;

const FRAME_death01 = 62;
const FRAME_death10 = 71;
const FRAME_death16 = 77;

// Sounds
let sound_pain1: number;
let sound_pain2: number;
let sound_pain3: number;
let sound_death: number;
let sound_sight: number;
let sound_rail: number;
let sound_spawn: number;
let sound_cg_down: number;
let sound_cg_loop: number;
let sound_cg_up: number;

const carrier_flash_offset = {
  MZ2_CARRIER_MACHINEGUN_L1: {x: 29.6, y: 56.7, z: -18.7},
  MZ2_CARRIER_MACHINEGUN_R1: {x: 29.6, y: -56.7, z: -18.7},
  MZ2_CARRIER_GRENADE: {x: 11.0, y: 10.6, z: -26.0},
  MZ2_CARRIER_ROCKET_1: {x: 16.5, y: 11.2, z: 57.6},
  MZ2_CARRIER_ROCKET_2: {x: 16.5, y: 3.8, z: 57.6},
  MZ2_CARRIER_ROCKET_3: {x: 16.5, y: -3.8, z: 57.6},
  MZ2_CARRIER_ROCKET_4: {x: 16.5, y: -11.2, z: 57.6},
  MZ2_CARRIER_RAILGUN: {x: 25.1, y: 8.5, z: -7.5},
  MZ2_CARRIER_MACHINEGUN_L2: {x: 29.6, y: 56.7, z: -18.7},
  MZ2_CARRIER_MACHINEGUN_R2: {x: 29.6, y: -56.7, z: -18.7},
};

function CarrierCoopCheck(self: Entity, context: EntitySystem): void {
  if (!self.monsterinfo.fire_wait) self.monsterinfo.fire_wait = 0;
  if (self.monsterinfo.fire_wait > context.entities.timeSeconds) return;

  const targets: Entity[] = [];

  context.game.clients.forEach((client) => {
    const ent = client.ent;
    if (!ent || !ent.inUse) return;
    if (inback(self, ent) || below(self, ent)) {
      const tr = context.trace(self.origin, ent.origin, self, Solid.BoundingBox);
      if (tr.fraction === 1.0) {
        targets.push(ent);
      }
    }
  });

  if (targets.length === 0) return;

  const target = targets[irandom(0, targets.length - 1)];

  self.monsterinfo.fire_wait = context.entities.timeSeconds + CARRIER_ROCKET_TIME;

  const oldEnemy = self.enemy;
  self.enemy = target;
  CarrierRocket(self, context);
  self.enemy = oldEnemy;
}

function CarrierGrenade(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);

  if (!self.enemy) return;

  const direction = frandom() < 0.5 ? -1.0 : 1.0;

  if (!self.timestamp) self.timestamp = 0;
  const mytime = Math.floor((context.entities.timeSeconds - self.timestamp) / 0.4);

  let spreadR = 0;
  let spreadU = 0;

  if (mytime === 0) {
    spreadR = 0.15 * direction;
    spreadU = 0.1 - 0.1 * direction;
  } else if (mytime === 1) {
    spreadR = 0;
    spreadU = 0.1;
  } else if (mytime === 2) {
    spreadR = -0.15 * direction;
    spreadU = 0.1 - -0.1 * direction;
  } else if (mytime === 3) {
    spreadR = 0;
    spreadU = 0.1;
  } else {
    spreadR = 0;
    spreadU = 0;
  }

  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  const up = { x: 0, y: 0, z: 0 };
  AngleVectors(self.angles, forward, right, up);

  const start = M_ProjectFlashSource(self, carrier_flash_offset.MZ2_CARRIER_GRENADE, forward, right);

  const aim = subtractVec3(self.enemy.origin, start);
  const dist = lengthVec3(aim);
  const normalizedAim = normalizeVec3(aim);

  const rightSpread = scaleVec3(right, spreadR);
  const upSpread = scaleVec3(up, spreadU);

  const finalAim = addVec3(addVec3(normalizedAim, rightSpread), upSpread);

  if (finalAim.z > 0.15) finalAim.z = 0.15;
  else if (finalAim.z < -0.5) finalAim.z = -0.5;

  const flash_number = MuzzleFlash.GunnerGrenade1;
  monster_fire_grenade(self, start, finalAim, 50, 600, flash_number, context);
}

function CarrierPredictiveRocket(self: Entity, context: EntitySystem): void {
  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  AngleVectors(self.angles, forward, right, null);

  const offsets = [
    { offset: carrier_flash_offset.MZ2_CARRIER_ROCKET_1, flash: MuzzleFlash.CarrierRocket1, scale: -0.3 },
    { offset: carrier_flash_offset.MZ2_CARRIER_ROCKET_2, flash: MuzzleFlash.CarrierRocket2, scale: -0.15 },
    { offset: carrier_flash_offset.MZ2_CARRIER_ROCKET_3, flash: MuzzleFlash.CarrierRocket3, scale: 0 },
    { offset: carrier_flash_offset.MZ2_CARRIER_ROCKET_4, flash: MuzzleFlash.CarrierRocket4, scale: 0.15 }
  ];

  for (const item of offsets) {
    const start = M_ProjectFlashSource(self, item.offset, forward, right);
    const dir = { x: 0, y: 0, z: 0 };
    PredictAim(context, self, self.enemy!, start, CARRIER_ROCKET_SPEED, false, item.scale);
    monster_fire_rocket(self, start, dir, 50, CARRIER_ROCKET_SPEED, item.flash, context);
  }
}

function CarrierRocket(self: Entity, context: EntitySystem): void {
  if (self.enemy) {
    if (self.enemy.client && frandom() < 0.5) {
      CarrierPredictiveRocket(self, context);
      return;
    }
  } else {
    return;
  }

  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  AngleVectors(self.angles, forward, right, null);

  const fire = (offset: Vec3, zAdjust: number, rightScale: number, flash: number) => {
    const start = M_ProjectFlashSource(self, offset, forward, right);
    const vec = copyVec3(self.enemy!.origin);
    vec.z -= zAdjust;
    const dir = subtractVec3(vec, start);
    const normalizedDir = normalizeVec3(dir);
    const rightVec = scaleVec3(right, rightScale);
    const finalDir = normalizeVec3(addVec3(normalizedDir, rightVec));
    monster_fire_rocket(self, start, finalDir, 50, 500, flash, context);
  };

  fire(carrier_flash_offset.MZ2_CARRIER_ROCKET_1, 15, 0.4, MuzzleFlash.CarrierRocket1);
  fire(carrier_flash_offset.MZ2_CARRIER_ROCKET_2, 0, 0.025, MuzzleFlash.CarrierRocket2);
  fire(carrier_flash_offset.MZ2_CARRIER_ROCKET_3, 0, -0.025, MuzzleFlash.CarrierRocket3);
  fire(carrier_flash_offset.MZ2_CARRIER_ROCKET_4, 15, -0.4, MuzzleFlash.CarrierRocket4);
}

function carrier_firebullet_right(self: Entity, context: EntitySystem): void {
  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  let flashnum: number;

  if (self.monsterinfo.aiflags & AI_MANUAL_STEERING) {
    flashnum = MuzzleFlash.CarrierMachineGunR2;
  } else {
    flashnum = MuzzleFlash.CarrierMachineGunR1;
  }

  AngleVectors(self.angles, forward, right, null);
  const start = M_ProjectFlashSource(self, carrier_flash_offset.MZ2_CARRIER_MACHINEGUN_R1, forward, right);
  const dir = { x: 0, y: 0, z: 0 };
  PredictAim(context, self, self.enemy!, start, 0, true, -0.3);
  monster_fire_bullet(self, start, dir, 6, 4, 0, 0, flashnum, context);
}

function carrier_firebullet_left(self: Entity, context: EntitySystem): void {
  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  let flashnum: number;

  if (self.monsterinfo.aiflags & AI_MANUAL_STEERING) {
    flashnum = MuzzleFlash.CarrierMachineGunL2;
  } else {
    flashnum = MuzzleFlash.CarrierMachineGunL1;
  }

  AngleVectors(self.angles, forward, right, null);
  const start = M_ProjectFlashSource(self, carrier_flash_offset.MZ2_CARRIER_MACHINEGUN_L1, forward, right);
  const dir = { x: 0, y: 0, z: 0 };
  PredictAim(context, self, self.enemy!, start, 0, true, -0.3);
  monster_fire_bullet(self, start, dir, 6, 4, 0, 0, flashnum, context);
}

function CarrierMachineGun(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  if (self.enemy) carrier_firebullet_left(self, context);
  if (self.enemy) carrier_firebullet_right(self, context);
}

function CarrierSpawn(self: Entity, context: EntitySystem): void {
  const f = { x: 0, y: 0, z: 0 };
  const r = { x: 0, y: 0, z: 0 };
  const offset = { x: 105, y: 0, z: -58 };
  AngleVectors(self.angles, f, r, null);

  const startpoint = M_ProjectFlashSource(self, offset, f, r);

  if (!self.monsterinfo.chosen_reinforcements) return;
  if (self.monsterinfo.chosen_reinforcements[0] === 255) return;

  const reinforcement = self.monsterinfo.reinforcements!.reinforcements[self.monsterinfo.chosen_reinforcements[0]];

  const spawnpoint = { x: 0, y: 0, z: 0 };

  if (findSpawnPoint(startpoint, reinforcement.mins, reinforcement.maxs, spawnpoint, 32, context)) {
    let ent: Entity | null = null;

    ent = context.spawn();
    ent.classname = reinforcement.classname;
    copyVec3(spawnpoint, ent.origin);
    copyVec3(self.angles, ent.angles);

    if (ent.classname === 'monster_flyer') {
       createFlyer(ent, context);
    } else if (ent.classname === 'monster_kamikaze') {
       // createKamikaze(ent, context);
       console.warn('monster_kamikaze not implemented yet');
       context.free(ent);
       return;
    } else {
       console.warn(`Carrier tried to spawn unknown monster: ${ent.classname}`);
       context.free(ent);
       return;
    }

    if (!ent.inUse) return;

    context.sound(self, SoundChannel.Body, sound_spawn, 1, ATTN_NONE, 0);

    ent.nextthink = context.entities.timeSeconds;
    if (ent.think) ent.think(ent, context);

    ent.monsterinfo.aiflags |= AI_SPAWNED_CARRIER | AI_DO_NOT_COUNT | AI_IGNORE_SHOTS;
    ent.monsterinfo.commander = self;
    ent.monsterinfo.monster_slots = reinforcement.strength;

    if (!self.monsterinfo.monster_used) self.monsterinfo.monster_used = 0;
    self.monsterinfo.monster_used += reinforcement.strength;

    if (self.enemy && self.enemy.inUse && self.enemy.health > 0) {
      ent.enemy = self.enemy;
    }
  }
}

function carrier_prep_spawn(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  self.monsterinfo.aiflags |= AI_MANUAL_STEERING;
  self.timestamp = context.entities.timeSeconds;
  self.yaw_speed = 10;
}

function carrier_spawn_check(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  CarrierSpawn(self, context);

  if (context.entities.timeSeconds > self.timestamp + 2.0) {
    self.monsterinfo.aiflags &= ~AI_MANUAL_STEERING;
    self.yaw_speed = self.monsterinfo.orig_yaw_speed!;
  } else {
    self.monsterinfo.nextframe = FRAME_spawn08;
  }
}

function carrier_ready_spawn(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);

  const current_yaw = anglemod(self.angles.y);
  if (Math.abs(current_yaw - self.ideal_yaw) > 0.1) {
    self.monsterinfo.aiflags |= AI_HOLD_FRAME;
    self.timestamp += 0.1;
    return;
  }

  self.monsterinfo.aiflags &= ~AI_HOLD_FRAME;

  // Pick reinforcements
  const result = M_PickReinforcements(self, 1);
  self.monsterinfo.chosen_reinforcements = result.chosen;
  const num_summoned = result.count;

  if (!num_summoned) return;

  const reinforcement = self.monsterinfo.reinforcements!.reinforcements[self.monsterinfo.chosen_reinforcements[0]];

  const offset = { x: 105, y: 0, z: -58 };
  const f = { x: 0, y: 0, z: 0 };
  const r = { x: 0, y: 0, z: 0 };
  AngleVectors(self.angles, f, r, null);
  const startpoint = M_ProjectFlashSource(self, offset, f, r);
  const spawnpoint = { x: 0, y: 0, z: 0 };

  if (findSpawnPoint(startpoint, reinforcement.mins, reinforcement.maxs, spawnpoint, 32, context)) {
     // SpawnGrow_Spawn
  }
}

function carrier_start_spawn(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  if (!self.monsterinfo.orig_yaw_speed) {
    self.monsterinfo.orig_yaw_speed = self.yaw_speed;
  }

  if (!self.enemy) return;

  const mytime = Math.floor((context.entities.timeSeconds - self.timestamp) / 0.5);

  const temp = subtractVec3(self.enemy.origin, self.origin);
  const enemy_yaw = vectoyaw(temp);

  if (mytime === 0) {
    self.ideal_yaw = anglemod(enemy_yaw - 30);
  } else if (mytime === 1) {
    self.ideal_yaw = anglemod(enemy_yaw);
  } else if (mytime === 2) {
    self.ideal_yaw = anglemod(enemy_yaw + 30);
  }
}

function carrier_run(self: Entity, context: EntitySystem): void {
  self.monsterinfo.aiflags &= ~AI_HOLD_FRAME;
  if (self.monsterinfo.aiflags & AI_STAND_GROUND) {
    M_SetAnimation(self, carrier_move_stand, context);
  } else {
    M_SetAnimation(self, carrier_move_run, context);
  }
}

function carrier_dead(self: Entity, context: EntitySystem): void {
  // Explosion effect
  context.game.multicast(self.origin, MulticastType.Pbs, ServerCommand.temp_entity, 1, self.origin); // 1 = TE_EXPLOSION1, placeholder

  self.s.sound = 0;
  self.s.skinnum = Math.floor(self.s.skinnum / 2);
  if (!self.gravityVector) self.gravityVector = { x: 0, y: 0, z: 0 };
  self.gravityVector.z = -1.0;

  throwGibs(context.entities, self.origin, 500, GibType.Metallic, ModId.Unknown);
}

function CarrierSpool(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  context.sound(self, SoundChannel.Body, sound_cg_up, 1, 0.5, 0);
  self.monsterinfo.weapon_sound = sound_cg_loop;
}

function carrier_attack_mg_start(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  M_SetAnimation(self, carrier_move_attack_mg, context);
  self.monsterinfo.melee_debounce_time = context.entities.timeSeconds + random_time(1.2, 2.0);
}

function carrier_reattack_mg(self: Entity, context: EntitySystem): void {
  CarrierMachineGun(self, context);
  CarrierCoopCheck(self, context);

  if (visible(self, self.enemy!, context) && infront(self, self.enemy!)) {
    if (frandom() < 0.6) {
      if (!self.monsterinfo.melee_debounce_time) self.monsterinfo.melee_debounce_time = 0;
      self.monsterinfo.melee_debounce_time += random_time(0.25, 0.5);
      M_SetAnimation(self, carrier_move_attack_mg, context);
      return;
    } else if (self.monsterinfo.melee_debounce_time && self.monsterinfo.melee_debounce_time > context.entities.timeSeconds) {
       M_SetAnimation(self, carrier_move_attack_mg, context);
       return;
    }
  }

  M_SetAnimation(self, carrier_move_attack_post_mg, context);
  self.monsterinfo.weapon_sound = 0;
  context.sound(self, SoundChannel.Body, sound_cg_down, 1, 0.5, 0);
}

function carrier_attack_gren(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  self.timestamp = context.entities.timeSeconds;
  M_SetAnimation(self, carrier_move_attack_gren, context);
}

function carrier_reattack_gren(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  if (infront(self, self.enemy!)) {
    if (self.timestamp + 1.3 > context.entities.timeSeconds) {
      M_SetAnimation(self, carrier_move_attack_gren, context);
      return;
    }
  }
  M_SetAnimation(self, carrier_move_attack_post_gren, context);
}

function CarrierRail(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  const forward = { x: 0, y: 0, z: 0 };
  const right = { x: 0, y: 0, z: 0 };
  AngleVectors(self.angles, forward, right, null);
  const start = M_ProjectFlashSource(self, carrier_flash_offset.MZ2_CARRIER_RAILGUN, forward, right);

  const dir = subtractVec3(self.pos1, start);
  const normalizedDir = normalizeVec3(dir);

  monster_fire_railgun(self, start, normalizedDir, 50, 100, MuzzleFlash.CarrierRailgun, context);
  self.monsterinfo.attack_finished = context.entities.timeSeconds + RAIL_FIRE_TIME;
}

function CarrierSaveLoc(self: Entity, context: EntitySystem): void {
  CarrierCoopCheck(self, context);
  copyVec3(self.enemy!.origin, self.pos1);
  self.pos1.z += self.enemy!.viewheight;
}

// Animation definitions

const carrier_frames_stand = [
  { think: ai_stand, dist: 0 }, // dist required by MonsterFrame
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 },
  { think: ai_stand, dist: 0 }
];

const carrier_move_stand: MonsterMove = {
  firstframe: FRAME_search01,
  lastframe: FRAME_search13,
  frames: carrier_frames_stand as any,
  endfunc: null
};

const carrier_frames_walk = [
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 },
  { think: ai_walk, dist: 4 }
];

const carrier_move_walk: MonsterMove = {
  firstframe: FRAME_search01,
  lastframe: FRAME_search13,
  frames: carrier_frames_walk as any,
  endfunc: null
};

const carrier_frames_run = [
  { think: ai_run, dist: 6, action: CarrierCoopCheck }, // Using think prop for action for now if mapped
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck },
  { think: ai_run, dist: 6, action: CarrierCoopCheck }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_run: MonsterMove = {
  firstframe: FRAME_search01,
  lastframe: FRAME_search13,
  frames: carrier_frames_run,
  endfunc: null
};

const carrier_frames_attack_pre_mg = [
  { think: ai_charge, dist: 4, action: CarrierSpool },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: carrier_attack_mg_start }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_pre_mg: MonsterMove = {
  firstframe: FRAME_firea01,
  lastframe: FRAME_firea08,
  frames: carrier_frames_attack_pre_mg,
  endfunc: null
};

const carrier_frames_attack_mg = [
  { think: ai_charge, dist: -2, action: CarrierMachineGun },
  { think: ai_charge, dist: -2, action: CarrierMachineGun },
  { think: ai_charge, dist: -2, action: carrier_reattack_mg }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_mg: MonsterMove = {
  firstframe: FRAME_firea09,
  lastframe: FRAME_firea11,
  frames: carrier_frames_attack_mg,
  endfunc: null
};

const carrier_frames_attack_post_mg = [
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_post_mg: MonsterMove = {
  firstframe: FRAME_firea12,
  lastframe: FRAME_firea15,
  frames: carrier_frames_attack_post_mg,
  endfunc: carrier_run
};

const carrier_frames_attack_pre_gren = [
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: carrier_attack_gren }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_pre_gren: MonsterMove = {
  firstframe: FRAME_fireb01,
  lastframe: FRAME_fireb06,
  frames: carrier_frames_attack_pre_gren,
  endfunc: null
};

const carrier_frames_attack_gren = [
  { think: ai_charge, dist: -15, action: CarrierGrenade },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: carrier_reattack_gren }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_gren: MonsterMove = {
  firstframe: FRAME_fireb07,
  lastframe: FRAME_fireb10,
  frames: carrier_frames_attack_gren,
  endfunc: null
};

const carrier_frames_attack_post_gren = [
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck },
  { think: ai_charge, dist: 4, action: CarrierCoopCheck }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_post_gren: MonsterMove = {
  firstframe: FRAME_fireb11,
  lastframe: FRAME_fireb16,
  frames: carrier_frames_attack_post_gren,
  endfunc: carrier_run
};

const carrier_frames_attack_rocket = [
  { think: ai_charge, dist: 15, action: CarrierRocket }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_rocket: MonsterMove = {
  firstframe: FRAME_fireb01,
  lastframe: FRAME_fireb01,
  frames: carrier_frames_attack_rocket,
  endfunc: carrier_run
};

const carrier_frames_attack_rail = [
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: 2, action: CarrierSaveLoc },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: -20, action: CarrierRail },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck },
  { think: ai_charge, dist: 2, action: CarrierCoopCheck }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_attack_rail: MonsterMove = {
  firstframe: FRAME_search01,
  lastframe: FRAME_search09,
  frames: carrier_frames_attack_rail,
  endfunc: carrier_run
};

const carrier_frames_spawn = [
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2, action: carrier_prep_spawn },
  { think: ai_charge, dist: -2, action: carrier_start_spawn },
  { think: ai_charge, dist: -2, action: carrier_ready_spawn },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -10, action: carrier_spawn_check },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 },
  { think: ai_charge, dist: -2 }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_spawn: MonsterMove = {
  firstframe: FRAME_spawn01,
  lastframe: FRAME_spawn18,
  frames: carrier_frames_spawn,
  endfunc: carrier_run
};

const carrier_frames_pain_heavy = [
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 }
].map(f => ({ ai: f.think, dist: f.dist, think: undefined }));

const carrier_move_pain_heavy: MonsterMove = {
  firstframe: FRAME_death01,
  lastframe: FRAME_death10,
  frames: carrier_frames_pain_heavy,
  endfunc: carrier_run
};

const carrier_frames_pain_light = [
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 }
].map(f => ({ ai: f.think, dist: f.dist, think: undefined }));

const carrier_move_pain_light: MonsterMove = {
  firstframe: FRAME_spawn01,
  lastframe: FRAME_spawn04,
  frames: carrier_frames_pain_light,
  endfunc: carrier_run
};

const carrier_frames_death = [
  { think: ai_move, dist: 0, action: carrier_dead }, // Using carrier_dead as BossExplode equivalent logic inside
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 },
  { think: ai_move, dist: 0 }
].map(f => ({ ai: f.think, dist: f.dist, think: f.action }));

const carrier_move_death: MonsterMove = {
  firstframe: FRAME_death01,
  lastframe: FRAME_death16,
  frames: carrier_frames_death,
  endfunc: carrier_dead // Actually invalid, usually death anim stays on last frame or removes.
  // Code uses carrier_dead as endfunc but carrier_dead throws gibs.
  // Wait, carrier_dead in C++ throws gibs.
  // The animation frames loop from death01 to death16.
  // The first frame calls BossExplode.
  // The last frame calls carrier_dead.
};

function carrier_pain(self: Entity, other: Entity | null, kick: number, damage: number): void {
  const context = self.monsterinfo.commander?.monsterinfo.commander?.['context'] || (self as any)['context']; // Hack to get context or pass it in signatures
  // Actually pain signature doesn't pass context. EntitySystem needs to be available or bound.
  // For now assuming we can't access context easily here unless we bind it.
  // Skipping sound/logic requiring context for a moment to fix build.

  // Actually we can't do much without context.
  // The port usually passes context or binds it.
  // I will assume context is available via a global game instance or similar if standard pattern.
  // But standard pattern is usually closures.

  // self.pain = (ent, other, kick, damage) => carrier_pain(ent, other, kick, damage, context);
  // This is how I will set it in createCarrier.
}

function carrier_pain_with_context(self: Entity, other: Entity | null, kick: number, damage: number, context: EntitySystem): void {
  if (context.entities.timeSeconds < self.pain_debounce_time) return;

  self.pain_debounce_time = context.entities.timeSeconds + 5.0;

  if (damage < 10) context.sound(self, SoundChannel.Voice, sound_pain3, 1, ATTN_NONE, 0);
  else if (damage < 30) context.sound(self, SoundChannel.Voice, sound_pain1, 1, ATTN_NONE, 0);
  else context.sound(self, SoundChannel.Voice, sound_pain2, 1, ATTN_NONE, 0);

  if (!M_ShouldReactToPain(self, context)) return;

  self.monsterinfo.weapon_sound = 0;

  let changed = false;
  if (damage >= 10) {
    if (damage < 30) {
      if (frandom() < 0.5) { // MOD check removed for simplicity
        changed = true;
        M_SetAnimation(self, carrier_move_pain_light, context);
      }
    } else {
      M_SetAnimation(self, carrier_move_pain_heavy, context);
      changed = true;
    }
  }

  if (changed) {
    self.monsterinfo.aiflags &= ~AI_HOLD_FRAME;
    self.monsterinfo.aiflags &= ~AI_MANUAL_STEERING;
    self.yaw_speed = self.monsterinfo.orig_yaw_speed!;
  }
}

function carrier_die_with_context(self: Entity, inflictor: Entity | null, attacker: Entity | null, damage: number, point: Vec3, mod: Mod, context: EntitySystem): void {
  context.sound(self, SoundChannel.Voice, sound_death, 1, ATTN_NONE, 0);
  self.deadflag = DeadFlag.Dead;
  self.takedamage = false;
  self.count = 0;
  M_SetAnimation(self, carrier_move_death, context);
  self.velocity = { x: 0, y: 0, z: 0 };
  if (!self.gravityVector) self.gravityVector = { x: 0, y: 0, z: 0 };
  self.gravityVector.z *= 0.01;
  self.monsterinfo.weapon_sound = 0;
}

function carrier_checkattack(self: Entity, context: EntitySystem): boolean {
  const enemy_infront = infront(self, self.enemy!);
  const enemy_inback = inback(self, self.enemy!);
  const enemy_below = below(self, self.enemy!);

  if (enemy_inback || (!enemy_infront && enemy_below)) {
    if (!self.monsterinfo.fire_wait) self.monsterinfo.fire_wait = 0;
    if (context.entities.timeSeconds >= self.monsterinfo.fire_wait) {
      self.monsterinfo.fire_wait = context.entities.timeSeconds + CARRIER_ROCKET_TIME;
      self.monsterinfo.attack!(self, context);
      if (frandom() < 0.6) {
        // AS_SLIDING - Not fully implemented in TS port usually, but we can set it.
      } else {
        // AS_STRAIGHT
      }
      return true;
    }
  }

  return M_CheckAttack_Base(self, 0.4, 0.8, 0.8, 0.8, 0.5, 0, context);
}

function carrier_attack_with_context(self: Entity, context: EntitySystem): void {
  self.monsterinfo.aiflags &= ~AI_HOLD_FRAME;

  if (!self.enemy || !self.enemy.inUse) return;

  const enemy_inback = inback(self, self.enemy);
  const enemy_infront = infront(self, self.enemy);
  const enemy_below = below(self, self.enemy);

  // Helper to handle probability logic
  const maybe = (prob: number) => frandom() < prob;
  const attackReady = () => context.entities.timeSeconds < (self.monsterinfo.attack_finished || 0);

  // bad_area check skipped for now as property not on Entity yet?
  // if (self.bad_area) ...

  // AS_BLIND check omitted (assuming not used or different in TS)

  if (!enemy_inback && !enemy_infront && !enemy_below) {
    if (maybe(0.1) || attackReady()) {
      M_SetAnimation(self, carrier_move_attack_pre_mg, context);
    } else {
      context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
      M_SetAnimation(self, carrier_move_attack_rail, context);
    }
    return;
  }

  if (enemy_infront) {
    const vec = subtractVec3(self.enemy.origin, self.origin);
    const range = lengthVec3(vec);

    if (range <= 125) {
      if (maybe(0.8) || attackReady()) {
        M_SetAnimation(self, carrier_move_attack_pre_mg, context);
      } else {
        context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
        M_SetAnimation(self, carrier_move_attack_rail, context);
      }
    } else if (range < 600) {
      const luck = frandom();
      if (M_SlotsLeft(self) > 2) {
        if (luck <= 0.20) M_SetAnimation(self, carrier_move_attack_pre_mg, context);
        else if (luck <= 0.40) M_SetAnimation(self, carrier_move_attack_pre_gren, context);
        else if (luck <= 0.7 && !attackReady()) {
          context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
          M_SetAnimation(self, carrier_move_attack_rail, context);
        } else {
          M_SetAnimation(self, carrier_move_spawn, context);
        }
      } else {
        if (luck <= 0.30) M_SetAnimation(self, carrier_move_attack_pre_mg, context);
        else if (luck <= 0.65) M_SetAnimation(self, carrier_move_attack_pre_gren, context);
        else if (context.entities.timeSeconds >= (self.monsterinfo.attack_finished || 0)) {
           context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
           M_SetAnimation(self, carrier_move_attack_rail, context);
        } else {
           M_SetAnimation(self, carrier_move_attack_pre_mg, context);
        }
      }
    } else {
      const luck = frandom();
      if (M_SlotsLeft(self) > 2) {
        if (luck < 0.3) M_SetAnimation(self, carrier_move_attack_pre_mg, context);
        else if (luck < 0.65 && !attackReady()) {
          context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
          copyVec3(self.enemy.origin, self.pos1);
          self.pos1.z += self.enemy.viewheight;
          M_SetAnimation(self, carrier_move_attack_rail, context);
        } else {
          M_SetAnimation(self, carrier_move_spawn, context);
        }
      } else {
        if (luck < 0.45 || attackReady()) {
          M_SetAnimation(self, carrier_move_attack_pre_mg, context);
        } else {
          context.sound(self, SoundChannel.Weapon, sound_rail, 1, ATTN_NORM, 0);
          M_SetAnimation(self, carrier_move_attack_rail, context);
        }
      }
    }
  } else if (enemy_below || enemy_inback) {
    M_SetAnimation(self, carrier_move_attack_rocket, context);
  }
}

function carrier_setskin(self: Entity): void {
  if (self.health < (self.max_health / 2)) {
    self.skin = 1;
  } else {
    self.skin = 0;
  }
}

export function createCarrier(self: Entity, context: EntitySystem): void {
  if (!M_AllowSpawn(self, context)) {
    G_FreeEdict(self, context);
    return;
  }

  sound_pain1 = context.soundIndex('carrier/pain_md.wav');
  sound_pain2 = context.soundIndex('carrier/pain_lg.wav');
  sound_pain3 = context.soundIndex('carrier/pain_sm.wav');
  sound_death = context.soundIndex('carrier/death.wav');
  sound_rail = context.soundIndex('gladiator/railgun.wav');
  sound_sight = context.soundIndex('carrier/sight.wav');
  sound_spawn = context.soundIndex('medic_commander/monsterspawn1.wav');

  sound_cg_down = context.soundIndex('weapons/chngnd1a.wav');
  sound_cg_loop = context.soundIndex('weapons/chngnl1a.wav');
  sound_cg_up = context.soundIndex('weapons/chngnu1a.wav');

  self.monsterinfo.engine_sound = context.soundIndex('bosshovr/bhvengn1.wav');

  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.modelindex = context.modelIndex('models/monsters/carrier/tris.md2');

  // Precache gibs
  context.modelIndex('models/monsters/carrier/gibs/base.md2');
  context.modelIndex('models/monsters/carrier/gibs/chest.md2');
  // ... others

  self.mins = { x: -56, y: -56, z: -44 };
  self.maxs = { x: 56, y: 56, z: 44 };

  // Health
  const skill = context.game.cvars.skill.value;
  self.health = Math.max(2000, 2000 + 1000 * (skill - 1));
  if (context.game.deathmatch) { // coop check usually
     // self.health += 500 * skill;
  }

  // self.gib_health = -200; // Not on entity type yet
  self.mass = 1000;

  self.yaw_speed = 15;
  self.monsterinfo.orig_yaw_speed = self.yaw_speed;

  self.flags |= EntityFlags.ImmuneLaser;
  self.monsterinfo.aiflags |= AI_IGNORE_SHOTS;

  self.pain = (ent, other, kick, damage) => carrier_pain_with_context(ent, other, kick, damage, context);
  self.die = (ent, infl, att, dmg, pt, mod) => carrier_die_with_context(ent, infl, att, dmg, pt, mod, context);

  self.monsterinfo.stand = (ent, ctx) => M_SetAnimation(ent, carrier_move_stand, ctx);
  self.monsterinfo.walk = (ent, ctx) => M_SetAnimation(ent, carrier_move_walk, ctx);
  self.monsterinfo.run = (ent, ctx) => carrier_run(ent, ctx);
  self.monsterinfo.attack = (ent, ctx) => carrier_attack_with_context(ent, ctx);
  self.monsterinfo.sight = (ent, other) => context.sound(ent, SoundChannel.Voice, sound_sight, 1, ATTN_NORM, 0);
  self.monsterinfo.checkattack = carrier_checkattack;
  self.monsterinfo.setskin = carrier_setskin;

  context.linkentity(self);

  M_SetAnimation(self, carrier_move_stand, context);
  self.monsterinfo.scale = MODEL_SCALE;

  flymonster_start(self, context);

  self.monsterinfo.attack_finished = 0;

  // Reinforcements
  let reinforcements = DEFAULT_REINFORCEMENTS;
  // if (!self.monsterinfo.monster_slots) {
    self.monsterinfo.monster_slots = DEFAULT_MONSTER_SLOTS_BASE;
  // }

  if (self.monsterinfo.monster_slots && reinforcements) {
    if (skill > 0) {
      self.monsterinfo.monster_slots += Math.floor(self.monsterinfo.monster_slots * (skill / 2.0));
    }
    // M_SetupReinforcements(reinforcements, self.monsterinfo.reinforcements!);
    self.monsterinfo.reinforcements = { reinforcements: [], num_reinforcements: 0 };
    M_SetupReinforcementsWithContext(reinforcements, self.monsterinfo.reinforcements, context);
  }

  self.monsterinfo.aiflags |= AI_ALTERNATE_FLY;
  self.monsterinfo.fly_acceleration = 5;
  self.monsterinfo.fly_speed = 50;
  self.monsterinfo.fly_above = true;
  self.monsterinfo.fly_min_distance = 1000;
  self.monsterinfo.fly_max_distance = 1000;
}

export function registerCarrier(context: EntitySystem): void {
  registerMonsterSpawns(context, [
    ['monster_carrier', createCarrier]
  ]);
}
