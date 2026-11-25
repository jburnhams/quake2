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
  /** Milliseconds this command covers; the move lasts msec / 1000 seconds. */
  readonly msec?: number;
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
  /** What was hit, passed through untouched for the touch list (pm.touch). */
  readonly ent?: unknown;
}

/**
 * A box trace for the movement code. `contentMask` is what p_move.cpp passes to pm->trace:
 * MASK_PLAYERSOLID for most moves, CONTENTS_LADDER for the ladder probe, MASK_SOLID and
 * MASK_WATER for the water checks, MASK_DEADSOLID for a dead player. An import that leaves it
 * out traces the player's usual mask, so ladders and water jumps are not found.
 */
export type PmoveTraceFn = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3, contentMask?: number) => PmoveTraceResult;

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
  /**
   * pm.touch: the traces that hit something during the move, one per thing hit (by `ent`),
   * for the game to call touch functions on. Filled in by runPmove.
   */
  touch?: readonly PmoveTraceResult[];
  /** pm_time: milliseconds left on a timed flag (water jump, landing, teleport, trick jump). */
  pmTime?: number;
  /** pm->snapinitial: the state was changed outside pmove, so nudge it out of solids first. */
  snapInitial?: boolean;
  /** Out: standing on something (pm->groundentity is set). */
  onGround?: boolean;
  /** Out: pm->groundentity, the `ent` of the ground trace, or null. */
  groundEntity?: unknown;
  /** Out: pm->groundplane's normal. */
  groundPlaneNormal?: Vec3;
  /** Out: pm->jump_sound, a jump started this frame. */
  jumpSound?: boolean;
  /** Out: pm->step_clip, the move clipped up onto a step while rising. */
  stepClip?: boolean;
  /** Out: pm->impact_delta, the vertical speed lost on landing (for falling damage). */
  impactDelta?: number;
}

export interface PmoveImports {
  trace: PmoveTraceFn;
  pointcontents: PmovePointContentsFn;
  /** pm->clip: the world only, for spectators. Falls back to `trace` with MASK_SOLID. */
  clip?: PmoveTraceFn;
}
