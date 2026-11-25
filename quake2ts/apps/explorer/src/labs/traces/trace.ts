// The traces lab's one step: a box swept through the map from the player's start, as the game
// sweeps one for every move, shot and sight check (traceBox, the same call pmove and the server
// make). Pure: a world and a setup in, what the sweep met out. The setup is an aim (turn from the
// start's heading, pitch, length), a lift above the start, the box's size and which contents stop it.
import { traceBox } from '@quake2ts/shared/bsp/collision';
import { MASK_PLAYERSOLID, MASK_SHOT, MASK_SOLID, MASK_WATER } from '@quake2ts/shared/bsp/contents';
import type { Vec } from '../orbit';
import type { LabWorld } from '../world';

export interface TraceSetup {
  /** Degrees turned left of the start's heading. */
  readonly turn: number;
  /** Degrees below level; negative looks up (Quake's pitch). */
  readonly pitch: number;
  /** How far the box is swept, in units. */
  readonly length: number;
  /** Units above the player's start the sweep begins. */
  readonly lift: number;
  /** Half the box's width; 0 is a point, as a shot traces, and 16 is the player's box. */
  readonly size: number;
}

export const DEFAULT_TRACE: TraceSetup = { turn: 0, pitch: 0, length: 512, lift: 0, size: 16 };

/** The masks the lab offers: which contents stop the sweep, as the game's callers choose. */
export const MASKS = {
  solid: { value: MASK_SOLID, label: 'Walls', detail: 'MASK_SOLID: solid brushes and windows. What sight and the camera check.' },
  player: { value: MASK_PLAYERSOLID, label: 'A player', detail: 'MASK_PLAYERSOLID: also player clip and bodies. What pmove sweeps.' },
  shot: { value: MASK_SHOT, label: 'A shot', detail: 'MASK_SHOT: walls and bodies, through player clip. What a bullet sweeps.' },
  water: { value: MASK_WATER, label: 'Liquid', detail: 'MASK_WATER: water, slime and lava only. How the game finds a surface to splash.' },
} as const;
export type MaskKey = keyof typeof MASKS;

/** The box the sweep carries: the player's proportions (-24 to 32 at size 16) scaled by size. */
export function traceBounds(size: number): { mins: Vec; maxs: Vec } {
  return { mins: { x: -size, y: -size, z: -size * 1.5 }, maxs: { x: size, y: size, z: size * 2 } };
}

export interface TraceOutcome {
  readonly start: Vec;
  /** Where the sweep was asked to go. */
  readonly end: Vec;
  /** Where the box stopped. */
  readonly endpos: Vec;
  readonly mins: Vec;
  readonly maxs: Vec;
  /** The share of the way the box got, 0 to 1. */
  readonly fraction: number;
  /** The distance it got, in units. */
  readonly travelled: number;
  /** The face it stopped on, or null when it got all the way. */
  readonly normal: Vec | null;
  /** Degrees the face it stopped on leans from level ground: 0 a floor, 90 a wall, 180 a ceiling. */
  readonly slope: number | null;
  readonly contents: number;
  readonly surfaceFlags: number;
  /** The box began inside something. */
  readonly startsolid: boolean;
  /** It never left it. */
  readonly allsolid: boolean;
}

/** The direction an aim points, from a yaw and a pitch in degrees (positive pitch looks down). */
export function aimDirection(yaw: number, pitch: number): Vec {
  const y = (yaw * Math.PI) / 180;
  const p = (pitch * Math.PI) / 180;
  return { x: Math.cos(p) * Math.cos(y), y: Math.cos(p) * Math.sin(y), z: -Math.sin(p) };
}

/** Sweeps the box through the world and says what it met. */
export function sweep(world: LabWorld, setup: TraceSetup, mask: MaskKey): TraceOutcome {
  const o = world.start.origin;
  const start = { x: o.x, y: o.y, z: o.z + setup.lift };
  const dir = aimDirection(world.start.yaw + setup.turn, setup.pitch);
  const end = { x: start.x + dir.x * setup.length, y: start.y + dir.y * setup.length, z: start.z + dir.z * setup.length };
  const { mins, maxs } = traceBounds(setup.size);
  const t = traceBox({ model: world.model, start, end, mins, maxs, contentMask: MASKS[mask].value });
  const normal = t.fraction < 1 && t.plane ? { ...t.plane.normal } : null;
  return {
    start,
    end,
    endpos: { ...t.endpos },
    mins,
    maxs,
    fraction: t.fraction,
    travelled: t.fraction * setup.length,
    normal,
    slope: normal ? (Math.acos(Math.max(-1, Math.min(1, normal.z))) * 180) / Math.PI : null,
    contents: t.contents ?? 0,
    surfaceFlags: t.surfaceFlags ?? 0,
    startsolid: t.startsolid,
    allsolid: t.allsolid,
  };
}
