// The slide and step lab's run: a player running into demo1's geometry by the game's own
// runPmove (a line-for-line port of p_move.cpp), with every trace pmove makes recorded. Pure:
// a world, a start and a setup in; each frame's state and its traces out. pmove asks the world
// only through traces, so the list of traces is the whole story of a frame: the sweeps of
// PM_StepSlideMove_Generic, each cut short by a plane and the velocity clipped along it; the same
// slide again from STEPSIZE higher; the push back down; and the ground checks around them.
import { MASK_PLAYERSOLID } from '@quake2ts/shared/bsp/contents';
import { pointContents, traceBox } from '@quake2ts/shared/bsp/collision';
import { PmFlag, PmType, runPmove, type PmoveImports, type PmoveState } from '@quake2ts/shared/pmove';
import { DEFAULT_LAB_TUNING } from '../movement/simulate';
import type { Vec } from '../orbit';
import type { LabWorld } from '../world';

/** The game's frame (40 Hz) and the run's length: one second. */
export const SLIDE_MSEC = 25;
export const SLIDE_FRAMES = 40;
/** cl_forwardspeed 200 with run held. */
const FORWARD = 400;
const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };

/** What a trace was for, read from its shape (pmove does not say). */
export type TraceRole = 'slide' | 'up' | 'down' | 'ground' | 'stuck';

export interface TraceRecord {
  readonly role: TraceRole;
  readonly start: Vec;
  readonly end: Vec;
  readonly mins: Vec;
  readonly maxs: Vec;
  readonly fraction: number;
  readonly endpos: Vec;
  /** The plane it stopped on, or null when it got all the way. */
  readonly normal: Vec | null;
  readonly startsolid: boolean;
  readonly allsolid: boolean;
}

export interface SlideFrame {
  /** 1-based, as the slider counts. */
  readonly frame: number;
  readonly before: Vec;
  readonly after: Vec;
  readonly speedBefore: number;
  readonly speedAfter: number;
  readonly onGround: boolean;
  /** How far the frame rose on the ground: a step up, if more than a slope gives. */
  readonly rise: number;
  readonly traces: readonly TraceRecord[];
  /** The planes the slide traces stopped on, in order. */
  readonly planes: readonly Vec[];
}

export interface SlideSetup {
  /** Degrees left of the place's heading. */
  readonly turn: number;
  /** STEPSIZE: the highest ledge walked up without a jump. */
  readonly stepSize: number;
}

export const DEFAULT_SLIDE: SlideSetup = { turn: 0, stepSize: 18 };

/** A place in demo1 to run from, and the way to face. */
export interface SlidePlace {
  readonly origin: Vec;
  readonly yaw: number;
}

const EPS = 0.01;
const same = (a: Vec, b: Vec) => Math.abs(a.x - b.x) < EPS && Math.abs(a.y - b.y) < EPS && Math.abs(a.z - b.z) < EPS;

function roleOf(start: Vec, end: Vec): TraceRole {
  if (same(start, end)) return 'stuck';
  const flat = Math.abs(start.x - end.x) < EPS && Math.abs(start.y - end.y) < EPS;
  if (!flat) return 'slide';
  const dz = end.z - start.z;
  if (dz > 0) return 'up';
  // PM_CatagorizePosition looks 0.25 below; the stair push and the step down look further.
  return dz > -1 ? 'ground' : 'down';
}

/** Runs forward from `place` for a second and records each frame's traces. */
export function runSlide(world: LabWorld, place: SlidePlace, setup: SlideSetup): SlideFrame[] {
  const { model } = world;
  let log: TraceRecord[] = [];
  const imports: PmoveImports = {
    trace: (start, end, mins, maxs, mask) => {
      const lo = mins ?? PLAYER_MINS;
      const hi = maxs ?? PLAYER_MAXS;
      const tr = traceBox({ model, start, end, mins: lo, maxs: hi, contentMask: mask || MASK_PLAYERSOLID });
      const normal = tr.planeNormal ?? tr.plane?.normal;
      log.push({
        role: roleOf(start, end),
        start: { ...start },
        end: { ...end },
        mins: { ...lo },
        maxs: { ...hi },
        fraction: tr.fraction,
        endpos: { ...tr.endpos },
        normal: tr.fraction < 1 && normal ? { ...normal } : null,
        startsolid: tr.startsolid,
        allsolid: tr.allsolid,
      });
      return { fraction: tr.fraction, endpos: tr.endpos, allsolid: tr.allsolid, startsolid: tr.startsolid, planeNormal: normal, contents: tr.contents, surfaceFlags: tr.surfaceFlags };
    },
    pointcontents: (p) => pointContents(p, model),
  };

  const yaw = place.yaw + setup.turn;
  const angles = { x: 0, y: yaw, z: 0 };
  const tuning = { ...DEFAULT_LAB_TUNING, stepSize: setup.stepSize };
  const cmd = { forwardmove: FORWARD, sidemove: 0, upmove: 0, buttons: 0, angles, msec: SLIDE_MSEC };
  let state: PmoveState = {
    pmType: PmType.Normal,
    pmFlags: 0,
    origin: place.origin,
    velocity: { x: 0, y: 0, z: 0 },
    angles,
    viewAngles: angles,
    viewHeight: 22,
    waterlevel: 0,
    watertype: 0,
    cmd,
    delta_angles: { x: 0, y: 0, z: 0 },
    gravity: DEFAULT_LAB_TUNING.gravity,
    mins: PLAYER_MINS,
    maxs: PLAYER_MAXS,
  };

  const frames: SlideFrame[] = [];
  for (let i = 0; i < SLIDE_FRAMES; i++) {
    log = [];
    const before = state;
    state = runPmove({ ...state, cmd }, imports, tuning);
    const onGround = (state.pmFlags & PmFlag.OnGround) !== 0;
    const traces = log;
    frames.push({
      frame: i + 1,
      before: before.origin,
      after: state.origin,
      speedBefore: Math.hypot(before.velocity.x, before.velocity.y),
      speedAfter: Math.hypot(state.velocity.x, state.velocity.y),
      onGround,
      rise: onGround && (before.pmFlags & PmFlag.OnGround) !== 0 ? state.origin.z - before.origin.z : 0,
      traces,
      planes: traces.filter((t) => t.role === 'slide' && t.normal).map((t) => t.normal!),
    });
  }
  return frames;
}

/** A frame stepped up when it rose on the ground by more than a slope pmove can walk gives in one frame. */
export const STEPPED = 2;
