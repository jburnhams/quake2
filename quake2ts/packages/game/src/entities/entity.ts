import type { Vec3, CollisionPlane } from '@quake2ts/shared';
import { ZERO_VEC3, RenderFx } from '@quake2ts/shared';
import { PlayerClient, hasItem } from '../inventory/playerInventory.js';
import type { EntitySystem } from './system.js';
import { DamageMod } from '../combat/damageMods.js';
import type { RegularArmorState, PowerArmorState } from '../combat/armor.js';
import { AmmoType } from '../inventory/ammo.js';
import { EntityFlags, EntityEffects, MuzzleFlash } from './enums.js';

export { RenderFx }; // Export RenderFx from shared for convenience if imported from entity.js
export { EntityFlags, EntityEffects, MuzzleFlash }; // Re-export for compatibility

export * from '../ai/constants.js';

export interface Reinforcement {
  classname: string;
  strength: number;
  mins: Vec3;
  maxs: Vec3;
}

// Changed to array to match medic.ts usage
export type ReinforcementList = Reinforcement[];

export enum MoveType {
  None = 0,
  Noclip = 1,
  Push = 2,
  Stop = 3,
  Walk = 4,
  Step = 5,
  Fly = 6,
  Toss = 7,
  FlyMissile = 8,
  Bounce = 9,
  WallBounce = 10,
}

export enum Solid {
  Not = 0,
  Trigger = 1,
  BoundingBox = 2,
  Bsp = 3,
}

export const SPAWNFLAG_NOT_EASY = 0x00000100;
export const SPAWNFLAG_NOT_MEDIUM = 0x00000200;
export const SPAWNFLAG_NOT_HARD = 0x00000400;
export const SPAWNFLAG_NOT_DEATHMATCH = 0x00000800;
export const SPAWNFLAG_NOT_COOP = 0x00001000;

export { DamageMod as ModId };
export type Mod = DamageMod;

export enum DamageFlags {
  None = 0,
  NoArmor = 1,
  Energy = 2,
  NoKnockback = 4,
  Bullet = 8,
  Radius = 16,
}

export enum GibType {
  Organic = 0,
  Metallic = 1,
}

export const SpawnFlag = {
    MonsterAmbush: 1,
};

export interface EntityState {
}

export enum ServerFlags {
  None = 0,
  NoClient = 1 << 0,
  DeadMonster = 1 << 1,
  Monster = 1 << 2,
  Player = 1 << 3,
  Bot = 1 << 4,
  NoBots = 1 << 5,
  Respawning = 1 << 6,
  Projectile = 1 << 7,
  Instanced = 1 << 8,
  Door = 1 << 9,
  NoCull = 1 << 10,
  Hull = 1 << 11,
}

export enum DeadFlag {
  Alive = 0,
  Dying = 1,
  Dead = 2,
  Respawnable = 3,
}

export interface CollisionSurface {
  name: string;
  flags: number;
  value: number;
}

export type ThinkCallback = (self: Entity, context: EntitySystem) => void;
// Replaced 'any' with specific types or explicitly kept 'any' where uncertain but documented
export type TouchCallback = (self: Entity, other: Entity | null, plane?: CollisionPlane | null, surf?: CollisionSurface | null) => void;
export type UseCallback = (self: Entity, other: Entity | null, activator?: Entity | null) => void;
export type BlockedCallback = (self: Entity, other: Entity | null, context?: EntitySystem) => void;
export type PainCallback = (self: Entity, other: Entity | null, kick: number, damage: number, mod: DamageMod) => void;
export type DieCallback = (
  self: Entity,
  inflictor: Entity | null,
  attacker: Entity | null,
  damage: number,
  point: Vec3,
  mod: DamageMod
) => void;

export type PlayerPainCallback = (self: Entity, damage: number) => void;

export type MonsterBlockedCallback = (self: Entity, dist: number, context: EntitySystem) => boolean | void;

export type EntityFieldType =
  | 'int'
  | 'float'
  | 'string'
  | 'vec3'
  | 'boolean'
  | 'entity'
  | 'inventory'
  | 'callback';

export interface EntityFieldDescriptor<K extends keyof Entity = keyof Entity> {
  readonly name: K;
  readonly type: EntityFieldType;
  readonly save: boolean;
}

const ZERO: Vec3 = { ...ZERO_VEC3 } as const;

function copyVec3(): Vec3 {
  return { ...ZERO };
}

export type MonsterAction = (self: Entity, context: EntitySystem) => void;
export type MonsterSightCallback = (self: Entity, enemy: Entity) => void;
export type AIAction = (self: Entity, dist: number, context: EntitySystem) => void;

export interface MonsterFrame {
  ai: AIAction | null;
  dist: number;
  think?: MonsterAction | null;
}

export interface MonsterMove {
  firstframe: number;
  lastframe: number;
  frames: MonsterFrame[];
  endfunc: MonsterAction | null;
}

export interface MoveInfo {
  start_origin?: Vec3;
  start_angles?: Vec3;
  end_origin?: Vec3;
  end_angles?: Vec3;
  sound_start?: number;
  sound_middle?: number;
  sound_end?: number;
  accel?: number;
  speed?: number;
  decel?: number;
  distance?: number;
  wait?: number;
  state?: number;
  dir?: Vec3;
  current_speed?: number;
  move_speed?: number;
  next_speed?: number;
  remaining_distance?: number;
  decel_distance?: number;
}

export interface MonsterInfo {
  current_move?: MonsterMove;
  aiflags: number;
  last_sighting: Vec3;
  trail_time: number;
  pausetime: number;
  run?: MonsterAction;
  stand?: MonsterAction;
  sight?: MonsterSightCallback;
  idle?: MonsterAction;
  search?: MonsterAction;
  attack?: MonsterAction;
  melee?: MonsterAction;
  walk?: MonsterAction;
  attack_machinegun?: MonsterMove;
  checkattack?: (self: Entity, context: EntitySystem) => boolean;
  attack_state?: number;
  lefty?: number;
  nextframe?: number;
  scale?: number;
  melee_debounce_time?: number;
  attack_finished?: number;
  power_armor_type?: number;
  power_armor_power?: number;
  blind_fire_target?: Vec3;
  blind_fire_delay?: number;
  fly_thrusters?: boolean;
  fly_acceleration?: number;
  fly_speed?: number;
  fly_min_distance?: number;
  fly_max_distance?: number;
  blindfire?: boolean;
  dodge?: (self: Entity, attacker: Entity, eta: number) => void;
  unduck?: (self: Entity) => void;
  duck?: (self: Entity, eta: number) => boolean;
  sidestep?: (self: Entity) => boolean;
  blocked?: MonsterBlockedCallback;
  setskin?: (self: Entity) => void;
  freeze_time?: number;

  jump_time?: number;
  jump_height?: number;
  drop_height?: number;
  can_jump?: boolean;

  monster_slots?: number;
  monster_used?: number;
  reinforcements?: ReinforcementList;
  chosen_reinforcements?: number[];
  badMedic1?: Entity;
  badMedic2?: Entity;
  healer?: Entity;
  medicTries?: number;
  commander?: Entity;
  fire_wait?: number;
  fly_above?: boolean;
  orig_yaw_speed?: number;
  base_height?: number;
  initial_power_armor_type?: number;
  max_power_armor_power?: number;
  base_health?: number;
  health_scaling?: number;
  react_to_damage_time?: number;
  weapon_sound?: number;
  engine_sound?: number;
}

const DEFAULT_MONSTER_INFO: MonsterInfo = Object.freeze({
  aiflags: 0,
  last_sighting: ZERO,
  trail_time: 0,
  pausetime: 0,
});

export class Entity {
  readonly index: number;

  inUse = false;
  freePending = false;
  linkPrevious: Entity | null = null;
  linkNext: Entity | null = null;

  classname = '';
  spawnflags = 0;
  target?: string;
  targetname?: string;
  killtarget?: string;
  team?: string;
  message?: string;
  pathtarget?: string;
  model?: string;
  item?: string;
  map?: string;

  inventory: Record<string, number> = {};

  origin: Vec3 = copyVec3();
  old_origin: Vec3 = copyVec3();
  velocity: Vec3 = copyVec3();
  avelocity: Vec3 = copyVec3();
  angles: Vec3 = copyVec3();
  pos1: Vec3 = copyVec3();
  pos2: Vec3 = copyVec3();
  gravityVector: Vec3 = copyVec3();

  viewheight = 0;

  mins: Vec3 = copyVec3();
  maxs: Vec3 = copyVec3();
  absmin: Vec3 = copyVec3();
  absmax: Vec3 = copyVec3();
  size: Vec3 = copyVec3();
  mass = 0;
  gravity = 1;
  bounce = 1;
  movetype: MoveType = MoveType.None;
  movedir: Vec3 = copyVec3();

  modelindex = 0;
  frame = 0;
  skin = 0;
  effects = 0;
  renderfx = 0;

  health = 0;
  max_health = 0;
  spawn_count = 0;
  takedamage = false;
  dmg = 0;
  radius_dmg = 0;
  dmg_radius = 0;
  speed = 0;
  accel = 0;
  decel = 0;
  height = 0;
  deadflag: DeadFlag = DeadFlag.Alive;
  count = 0;
  wait = 0;
  delay = 0;
  random = 0;
  timestamp = 0;
  lip = 0;
  state = 0;
  style = 0;
  sounds = 0;
  noise_index = 0;
  attenuation = 0;
  volume = 0;
  fly_sound_debounce_time = 0;
  last_move_time = 0;
  damage_debounce_time = 0;

  enemy: Entity | null = null;
  movetarget: Entity | null = null;
  target_ent: Entity | null = null;
  goalentity: Entity | null = null;
  ideal_yaw = 0;
  yaw_speed = 0;
  search_time = 0;
  attack_finished_time = 0;
  pain_finished_time = 0;
  pain_debounce_time = 0;
  trail_time = 0;

  groundentity: Entity | null = null;
  groundentity_linkcount = 0;
  waterlevel = 0;
  watertype = 0;

  nextthink = 0;
  think?: ThinkCallback;
  touch?: TouchCallback;
  use?: UseCallback;
  blocked?: BlockedCallback;
  pain?: PainCallback | PlayerPainCallback;
  die?: DieCallback;
  postthink?: ThinkCallback;
  activator: Entity | null = null;
  alpha = 0;

  solid: Solid = Solid.Not;
  clipmask = 0;
  flags = 0;
  svflags = 0;

  monsterinfo: MonsterInfo = { ...DEFAULT_MONSTER_INFO, last_sighting: copyVec3() };
  moveinfo?: MoveInfo;
  hackflags = 0;

  combattarget?: string;
  show_hostile = 0;
  light_level = 0;

  owner: Entity | null = null;
  beam: Entity | null = null;
  beam2: Entity | null = null;
  chain: Entity | null = null;

  client?: PlayerClient;

  _regularArmor?: RegularArmorState;
  _powerArmor?: PowerArmorState;

  get regularArmor(): RegularArmorState | undefined {
    if (this.client?.inventory.armor) {
      const invArmor = this.client.inventory.armor;
      return {
        get armorType() { return invArmor.armorType; },
        get armorCount() { return invArmor.armorCount; },
        set armorCount(v) { invArmor.armorCount = v; }
      };
    }
    return this._regularArmor;
  }

  set regularArmor(v: RegularArmorState | undefined) {
      this._regularArmor = v;
  }

  get powerArmor(): PowerArmorState | undefined {
    if (this.client) {
        let type: 'screen' | 'shield' | null = null;
        if (hasItem(this.client.inventory, 'item_power_shield')) {
            type = 'shield';
        } else if (hasItem(this.client.inventory, 'item_power_screen')) {
            type = 'screen';
        }

        if (type) {
             const ammo = this.client.inventory.ammo;
             const angles = this.client.v_angle || this.angles;

             return {
                 type,
                 get cellCount() { return ammo.counts[AmmoType.Cells] || 0; },
                 set cellCount(v) { ammo.counts[AmmoType.Cells] = v; },
                 angles: angles,
                 origin: this.origin,
                 health: this.health
             };
        }
        return undefined;
    }
    return this._powerArmor;
  }

  set powerArmor(v: PowerArmorState | undefined) {
      this._powerArmor = v;
  }

  constructor(index: number) {
    this.index = index;
  }

  reset(): void {
    this.inUse = false;
    this.freePending = false;
    this.linkPrevious = null;
    this.linkNext = null;

    this.classname = '';
    this.spawnflags = 0;
    this.target = undefined;
    this.targetname = undefined;
    this.killtarget = undefined;
    this.team = undefined;
    this.message = undefined;
    this.pathtarget = undefined;
    this.model = undefined;
    this.item = undefined;

    this.inventory = {};

    this.origin = copyVec3();
    this.old_origin = copyVec3();
    this.velocity = copyVec3();
    this.avelocity = copyVec3();
    this.angles = copyVec3();
    this.pos1 = copyVec3();
    this.pos2 = copyVec3();
    this.gravityVector = copyVec3();
    this.viewheight = 0;

    this.mins = copyVec3();
    this.maxs = copyVec3();
    this.absmin = copyVec3();
    this.absmax = copyVec3();
    this.size = copyVec3();
    this.mass = 0;
    this.gravity = 1;
    this.bounce = 1;
    this.movetype = MoveType.None;
    this.movedir = copyVec3();

    this.modelindex = 0;
    this.frame = 0;
    this.skin = 0;
    this.effects = 0;
    this.renderfx = 0;

    this.health = 0;
    this.max_health = 0;
    this.spawn_count = 0;
    this.takedamage = false;
    this.dmg = 0;
    this.speed = 0;
    this.accel = 0;
    this.decel = 0;
    this.height = 0;
    this.deadflag = DeadFlag.Alive;
    this.count = 0;
    this.wait = 0;
    this.delay = 0;
    this.timestamp = 0;
    this.lip = 0;
    this.state = 0;
    this.sounds = 0;
    this.noise_index = 0;
    this.fly_sound_debounce_time = 0;
    this.last_move_time = 0;
    this.damage_debounce_time = 0;

    this.enemy = null;
    this.movetarget = null;
    this.target_ent = null;
    this.goalentity = null;
    this.ideal_yaw = 0;
    this.yaw_speed = 0;
    this.search_time = 0;
    this.attack_finished_time = 0;
    this.pain_finished_time = 0;
    this.pain_debounce_time = 0;
    this.trail_time = 0;

    this.groundentity = null;
    this.groundentity_linkcount = 0;
    this.waterlevel = 0;
    this.watertype = 0;

    this.nextthink = 0;
    this.think = undefined;
    this.touch = undefined;
    this.use = undefined;
    this.blocked = undefined;
    this.pain = undefined;
    this.die = undefined;
    this.postthink = undefined;
    this.activator = null;
    this.alpha = 0;

    this.solid = Solid.Not;
    this.flags = 0;
    this.svflags = 0;

    this.monsterinfo = { ...DEFAULT_MONSTER_INFO, last_sighting: copyVec3() };
    this.moveinfo = undefined;
    this.hackflags = 0;

    this.combattarget = undefined;
    this.show_hostile = 0;
    this.light_level = 0;

    this.owner = null;
    this.beam = null;
    this.beam2 = null;
    this.chain = null;

    this._regularArmor = undefined;
    this._powerArmor = undefined;
  }
}

export enum AiFlags {
  StandGround = 1 << 0,
  TempStandGround = 1 << 1,
  SoundTarget = 1 << 2,
  LostSight = 1 << 3,
  PursuitLastSeen = 1 << 4,
  PursueNext = 1 << 5,
  PursueTemp = 1 << 6,
  HoldFrame = 1 << 7,
  GoodGuy = 1 << 8,
  Brutal = 1 << 9,
  NoStep = 1 << 10,
  ManualSteering = 1 << 11,
  Ducked = 1 << 12,
  CombatPoint = 1 << 13,
  Medic = 1 << 14,
  Resurrecting = 1 << 15,
  SpawnedCarrier = 1 << 16,
  IgnoreShots = 1 << 17,
  AlternateFly = 1 << 18,
  Dodging = 1 << 19,
  SpawnedMedicC = 1 << 23,

  // Aliases for compatibility
  SightCover = LostSight,
  Chicken = PursuitLastSeen,
  Flee = PursueNext,
  Stand = PursueTemp,
  FixTarget = HoldFrame,
  BrtMove = Brutal,
  DoNotCount = NoStep,
  ManualTarget = ManualSteering,
}

export const ENTITY_FIELD_METADATA: readonly EntityFieldDescriptor[] = [
  { name: 'classname', type: 'string', save: true },
  { name: 'spawnflags', type: 'int', save: true },
  { name: 'target', type: 'string', save: true },
  { name: 'targetname', type: 'string', save: true },
  { name: 'killtarget', type: 'string', save: true },
  { name: 'team', type: 'string', save: true },
  { name: 'message', type: 'string', save: true },
  { name: 'pathtarget', type: 'string', save: true },
  { name: 'model', type: 'string', save: true },
  { name: 'item', type: 'string', save: true },
  { name: 'map', type: 'string', save: true },
  { name: 'inventory', type: 'inventory', save: true },
  { name: 'origin', type: 'vec3', save: true },
  { name: 'old_origin', type: 'vec3', save: true },
  { name: 'velocity', type: 'vec3', save: true },
  { name: 'avelocity', type: 'vec3', save: true },
  { name: 'angles', type: 'vec3', save: true },
  { name: 'pos1', type: 'vec3', save: true },
  { name: 'pos2', type: 'vec3', save: true },
  { name: 'gravityVector', type: 'vec3', save: true },
  { name: 'viewheight', type: 'int', save: true },
  { name: 'mins', type: 'vec3', save: true },
  { name: 'maxs', type: 'vec3', save: true },
  { name: 'absmin', type: 'vec3', save: true },
  { name: 'absmax', type: 'vec3', save: true },
  { name: 'size', type: 'vec3', save: true },
  { name: 'mass', type: 'int', save: true },
  { name: 'gravity', type: 'float', save: true },
  { name: 'movetype', type: 'int', save: true },
  { name: 'movedir', type: 'vec3', save: true },
  { name: 'modelindex', type: 'int', save: true },
  { name: 'frame', type: 'int', save: true },
  { name: 'skin', type: 'int', save: true },
  { name: 'effects', type: 'int', save: true },
  { name: 'renderfx', type: 'int', save: true },
  { name: 'health', type: 'int', save: true },
  { name: 'max_health', type: 'int', save: true },
  { name: 'spawn_count', type: 'int', save: true },
  { name: 'takedamage', type: 'boolean', save: true },
  { name: 'dmg', type: 'int', save: true },
  { name: 'speed', type: 'float', save: true },
  { name: 'accel', type: 'float', save: true },
  { name: 'decel', type: 'float', save: true },
  { name: 'height', type: 'float', save: true },
  { name: 'deadflag', type: 'int', save: true },
  { name: 'count', type: 'int', save: true },
  { name: 'wait', type: 'float', save: true },
  { name: 'delay', type: 'float', save: true },
  { name: 'random', type: 'float', save: true },
  { name: 'timestamp', type: 'float', save: true },
  { name: 'lip', type: 'int', save: true },
  { name: 'state', type: 'int', save: true },
  { name: 'style', type: 'int', save: true },
  { name: 'sounds', type: 'int', save: true },
  { name: 'noise_index', type: 'int', save: true },
  { name: 'attenuation', type: 'float', save: true },
  { name: 'volume', type: 'float', save: true },
  { name: 'fly_sound_debounce_time', type: 'float', save: true },
  { name: 'last_move_time', type: 'float', save: true },
  { name: 'damage_debounce_time', type: 'float', save: true },
  { name: 'enemy', type: 'entity', save: true },
  { name: 'movetarget', type: 'entity', save: true },
  { name: 'target_ent', type: 'entity', save: true },
  { name: 'goalentity', type: 'entity', save: true },
  { name: 'ideal_yaw', type: 'float', save: true },
  { name: 'yaw_speed', type: 'float', save: true },
  { name: 'search_time', type: 'float', save: true },
  { name: 'attack_finished_time', type: 'float', save: true },
  { name: 'pain_finished_time', type: 'float', save: true },
  { name: 'pain_debounce_time', type: 'float', save: true },
  { name: 'trail_time', type: 'float', save: true },
  { name: 'groundentity', type: 'entity', save: true },
  { name: 'groundentity_linkcount', type: 'int', save: true },
  { name: 'waterlevel', type: 'int', save: true },
  { name: 'watertype', type: 'int', save: true },
  { name: 'nextthink', type: 'float', save: true },
  { name: 'solid', type: 'int', save: true },
  { name: 'flags', type: 'int', save: true },
  { name: 'svflags', type: 'int', save: true },
  { name: 'think', type: 'callback', save: false },
  { name: 'touch', type: 'callback', save: false },
  { name: 'use', type: 'callback', save: false },
  { name: 'blocked', type: 'callback', save: false },
  { name: 'pain', type: 'callback', save: false },
  { name: 'die', type: 'callback', save: false },
  { name: 'postthink', type: 'callback', save: false },
  { name: 'beam', type: 'entity', save: true },
  { name: 'beam2', type: 'entity', save: true },
  { name: 'chain', type: 'entity', save: true },
  { name: 'alpha', type: 'float', save: true },
  { name: 'hackflags', type: 'int', save: true },
];

export interface Damageable {
  health: number;
  max_health: number;
  takedamage: boolean;
  deadflag: DeadFlag;
  die?: DieCallback;
  pain?: PainCallback | PlayerPainCallback;
  origin: Vec3;
}

export interface Monster extends Damageable {
   monsterinfo: MonsterInfo;
   enemy: Entity | null;
}
