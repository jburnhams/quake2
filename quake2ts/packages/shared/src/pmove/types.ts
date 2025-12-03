import type { ContentsFlag } from '../bsp/contents.js';
import type { Vec3 } from '../math/vec3.js';
import type { PmFlags, PmType, WaterLevel, PlayerButton } from './constants.js';

export interface PmoveFrictionParams {
  readonly velocity: Vec3;
  readonly frametime: number;
  readonly onGround: boolean;
  readonly groundIsSlick: boolean;
  readonly onLadder: boolean;
  readonly waterlevel: number;
  readonly pmFriction: number;
  readonly pmStopSpeed: number;
  readonly pmWaterFriction: number;
}

export interface PmoveAccelerateParams {
  readonly velocity: Vec3;
  readonly wishdir: Vec3;
  readonly wishspeed: number;
  readonly accel: number;
  readonly frametime: number;
}

export interface PmoveCmd {
  readonly forwardmove: number;
  readonly sidemove: number;
  readonly upmove: number;
  readonly buttons: PlayerButton;
  readonly impulse?: number;
  readonly lightlevel?: number;
  readonly angles: Vec3;
}

export interface PmoveWishResult {
  readonly wishdir: Vec3;
  readonly wishspeed: number;
}

export interface PmoveWishParams {
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly cmd: PmoveCmd;
  readonly maxSpeed: number;
}

export interface PmoveTraceResult {
  readonly fraction: number;
  readonly endpos: Vec3;
  readonly planeNormal?: Vec3;
  readonly allsolid: boolean;
  readonly startsolid: boolean;
  readonly contents?: ContentsFlag;
  readonly surfaceFlags?: number;
}

export type PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) => PmoveTraceResult;

export type PmovePointContentsFn = (point: Vec3) => ContentsFlag;

// Missing exports added for runPmove
export interface PmoveState {
  pmType: PmType;
  pmFlags: PmFlags;
  origin: Vec3;
  velocity: Vec3;
  angles: Vec3;
  viewAngles: Vec3;
  viewHeight: number;
  waterlevel: WaterLevel;
  watertype: number;
  cmd: PmoveCmd;
  delta_angles: Vec3;
  gravity: number;
  mins: Vec3;
  maxs: Vec3;
}

export interface PmoveImports {
  trace: PmoveTraceFn;
  pointcontents: PmovePointContentsFn;
}
