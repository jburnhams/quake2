import type { Vec3 } from '../math/vec3.js';

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
}

export type PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) => PmoveTraceResult;

