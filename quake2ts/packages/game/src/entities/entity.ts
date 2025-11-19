import type { Vec3 } from '@quake2ts/shared';
import { ZERO_VEC3 } from '@quake2ts/shared';

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
}

export enum Solid {
  Not = 0,
  Trigger = 1,
  BoundingBox = 2,
  Bsp = 3,
}

export enum DeadFlag {
  Alive = 0,
  Dying = 1,
  Dead = 2,
  Respawnable = 3,
}

export type ThinkCallback = (self: Entity) => void;
export type TouchCallback = (self: Entity, other: Entity | null) => void;
export type UseCallback = (self: Entity, other: Entity | null) => void;
export type PainCallback = (self: Entity, other: Entity | null, kick: number, damage: number) => void;
export type DieCallback = (
  self: Entity,
  inflictor: Entity | null,
  attacker: Entity | null,
  damage: number,
) => void;

export type EntityFieldType =
  | 'int'
  | 'float'
  | 'string'
  | 'vec3'
  | 'boolean'
  | 'entity'
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
  team?: string;
  message?: string;

  origin: Vec3 = copyVec3();
  old_origin: Vec3 = copyVec3();
  velocity: Vec3 = copyVec3();
  avelocity: Vec3 = copyVec3();
  angles: Vec3 = copyVec3();

  mins: Vec3 = copyVec3();
  maxs: Vec3 = copyVec3();
  size: Vec3 = copyVec3();
  mass = 0;
  gravity = 1;
  movetype: MoveType = MoveType.None;

  modelindex = 0;
  frame = 0;
  skin = 0;
  effects = 0;
  renderfx = 0;

  health = 0;
  max_health = 0;
  takedamage = false;
  dmg = 0;
  deadflag: DeadFlag = DeadFlag.Alive;

  enemy: Entity | null = null;
  movetarget: Entity | null = null;
  goalentity: Entity | null = null;
  ideal_yaw = 0;
  yaw_speed = 0;

  groundentity: Entity | null = null;
  groundentity_linkcount = 0;
  waterlevel = 0;
  watertype = 0;

  nextthink = 0;
  think?: ThinkCallback;
  touch?: TouchCallback;
  use?: UseCallback;
  pain?: PainCallback;
  die?: DieCallback;

  solid: Solid = Solid.Not;
  flags = 0;
  svflags = 0;

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
    this.team = undefined;
    this.message = undefined;

    this.origin = copyVec3();
    this.old_origin = copyVec3();
    this.velocity = copyVec3();
    this.avelocity = copyVec3();
    this.angles = copyVec3();

    this.mins = copyVec3();
    this.maxs = copyVec3();
    this.size = copyVec3();
    this.mass = 0;
    this.gravity = 1;
    this.movetype = MoveType.None;

    this.modelindex = 0;
    this.frame = 0;
    this.skin = 0;
    this.effects = 0;
    this.renderfx = 0;

    this.health = 0;
    this.max_health = 0;
    this.takedamage = false;
    this.dmg = 0;
    this.deadflag = DeadFlag.Alive;

    this.enemy = null;
    this.movetarget = null;
    this.goalentity = null;
    this.ideal_yaw = 0;
    this.yaw_speed = 0;

    this.groundentity = null;
    this.groundentity_linkcount = 0;
    this.waterlevel = 0;
    this.watertype = 0;

    this.nextthink = 0;
    this.think = undefined;
    this.touch = undefined;
    this.use = undefined;
    this.pain = undefined;
    this.die = undefined;

    this.solid = Solid.Not;
    this.flags = 0;
    this.svflags = 0;
  }
}

export const ENTITY_FIELD_METADATA: readonly EntityFieldDescriptor[] = [
  { name: 'classname', type: 'string', save: true },
  { name: 'spawnflags', type: 'int', save: true },
  { name: 'target', type: 'string', save: true },
  { name: 'targetname', type: 'string', save: true },
  { name: 'team', type: 'string', save: true },
  { name: 'message', type: 'string', save: true },
  { name: 'origin', type: 'vec3', save: true },
  { name: 'old_origin', type: 'vec3', save: true },
  { name: 'velocity', type: 'vec3', save: true },
  { name: 'avelocity', type: 'vec3', save: true },
  { name: 'angles', type: 'vec3', save: true },
  { name: 'mins', type: 'vec3', save: true },
  { name: 'maxs', type: 'vec3', save: true },
  { name: 'size', type: 'vec3', save: true },
  { name: 'mass', type: 'int', save: true },
  { name: 'gravity', type: 'float', save: true },
  { name: 'movetype', type: 'int', save: true },
  { name: 'modelindex', type: 'int', save: true },
  { name: 'frame', type: 'int', save: true },
  { name: 'skin', type: 'int', save: true },
  { name: 'effects', type: 'int', save: true },
  { name: 'renderfx', type: 'int', save: true },
  { name: 'health', type: 'int', save: true },
  { name: 'max_health', type: 'int', save: true },
  { name: 'takedamage', type: 'boolean', save: true },
  { name: 'dmg', type: 'int', save: true },
  { name: 'deadflag', type: 'int', save: true },
  { name: 'enemy', type: 'entity', save: true },
  { name: 'movetarget', type: 'entity', save: true },
  { name: 'goalentity', type: 'entity', save: true },
  { name: 'ideal_yaw', type: 'float', save: true },
  { name: 'yaw_speed', type: 'float', save: true },
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
  { name: 'pain', type: 'callback', save: false },
  { name: 'die', type: 'callback', save: false },
];
