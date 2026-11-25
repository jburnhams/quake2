// The movement lab's run: the game's own player move (runPmove), traced through a map the
// explorer parsed, driven by one fixed script so that changing a constant is the only thing that
// changes the path. Pure and DOM-free, so the node tests run it on demo1 and the screen can run it
// on every slider change (100 frames take a few milliseconds).
import { traceBox, pointContents } from '@quake2ts/shared/bsp/collision';
import { MASK_PLAYERSOLID } from '@quake2ts/shared/bsp/contents';
import { worldFromMap, type LabWorld } from '../world';
import {
  DEFAULT_PMOVE_TUNING,
  PlayerButton,
  PmFlag,
  PmType,
  runPmove,
  type PmoveCmd,
  type PmoveImports,
  type PmoveState,
  type PmoveTuning,
} from '@quake2ts/shared/pmove';

/** The world a run happens in: the map's collision and where the player starts. */
export type MovementWorld = LabWorld;
export { worldFromMap };

type Vec = { readonly x: number; readonly y: number; readonly z: number };

/** One 40 Hz frame of a run, as the charts and readouts use it. */
export interface MovementFrame {
  /** Seconds since the run began. */
  readonly t: number;
  /** Horizontal distance from the start, in units. */
  readonly distance: number;
  /** Height above the floor the player first stands on, in units. */
  readonly height: number;
  /** Horizontal speed, in units per second. */
  readonly speed: number;
  readonly onGround: boolean;
  readonly origin: Vec;
}

/** sv_gravity's default. */
export const DEFAULT_GRAVITY = 800;
/** The game's frame (40 Hz) and the run's length: 2.5 seconds. */
export const FRAME_MSEC = 25;
export const RUN_FRAMES = 100;
/** cl_forwardspeed 200 with run held, as a player moves by default. */
const FORWARD = 400;
/** The script: run forward until RELEASE, jump once at JUMP, then let go and slide to a stop. */
export const JUMP_FRAME = 16;
export const RELEASE_FRAME = 60;

/** The tunable constants with gravity, which the game keeps on the state rather than in pmove. */
export type LabTuning = PmoveTuning & { readonly gravity: number };
export const DEFAULT_LAB_TUNING: LabTuning = Object.freeze({ ...DEFAULT_PMOVE_TUNING, gravity: DEFAULT_GRAVITY });

const PLAYER_MINS = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS = { x: 16, y: 16, z: 32 };

/** Runs the script in the world with the given constants and returns every frame. */
export function simulateRun(world: MovementWorld, tuning: LabTuning = DEFAULT_LAB_TUNING): MovementFrame[] {
  const { model, start } = world;
  const imports: PmoveImports = {
    trace: (from, to, mins, maxs) => {
      const tr = traceBox({ model, start: from, end: to, mins: mins ?? PLAYER_MINS, maxs: maxs ?? PLAYER_MAXS, contentMask: MASK_PLAYERSOLID });
      return {
        fraction: tr.fraction,
        endpos: tr.endpos,
        allsolid: tr.allsolid,
        startsolid: tr.startsolid,
        planeNormal: tr.planeNormal ?? tr.plane?.normal,
        contents: tr.contents,
        surfaceFlags: tr.surfaceFlags,
      };
    },
    pointcontents: (p) => pointContents(p, model),
  };
  const angles = { x: 0, y: start.yaw, z: 0 };
  const cmd = (frame: number): PmoveCmd => ({
    forwardmove: frame < RELEASE_FRAME ? FORWARD : 0,
    sidemove: 0,
    upmove: 0,
    buttons: frame === JUMP_FRAME ? PlayerButton.Jump : 0,
    angles,
    msec: FRAME_MSEC,
  });

  let state: PmoveState = {
    pmType: PmType.Normal,
    pmFlags: 0,
    origin: start.origin,
    velocity: { x: 0, y: 0, z: 0 },
    angles,
    viewAngles: angles,
    viewHeight: 22,
    waterlevel: 0,
    watertype: 0,
    cmd: cmd(0),
    delta_angles: { x: 0, y: 0, z: 0 },
    gravity: tuning.gravity,
    mins: PLAYER_MINS,
    maxs: PLAYER_MAXS,
  };

  const states: PmoveState[] = [];
  for (let i = 0; i < RUN_FRAMES; i++) {
    state = runPmove({ ...state, cmd: cmd(i), gravity: tuning.gravity }, imports, tuning);
    states.push(state);
  }
  const onGround = (s: PmoveState) => (s.pmFlags & PmFlag.OnGround) !== 0;
  const floor = (states.find(onGround) ?? states[0]!).origin.z;
  return states.map(({ origin, velocity, pmFlags }, i) => ({
    t: ((i + 1) * FRAME_MSEC) / 1000,
    distance: Math.hypot(origin.x - start.origin.x, origin.y - start.origin.y),
    height: origin.z - floor,
    speed: Math.hypot(velocity.x, velocity.y),
    onGround: (pmFlags & PmFlag.OnGround) !== 0,
    origin,
  }));
}

/** What the readouts say about a run. */
export function summarise(frames: readonly MovementFrame[]) {
  const last = frames.at(-1);
  const airborne = frames.filter((f) => !f.onGround).length;
  return {
    topSpeed: Math.max(0, ...frames.map((f) => f.speed)),
    peakHeight: Math.max(0, ...frames.map((f) => f.height)),
    distance: last?.distance ?? 0,
    airtime: (airborne * FRAME_MSEC) / 1000,
  };
}
