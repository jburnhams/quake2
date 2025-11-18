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

