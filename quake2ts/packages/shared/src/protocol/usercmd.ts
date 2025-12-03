import { angleMod } from '../math/angles.js';
import type { Vec3 } from '../math/vec3.js';
import { PlayerButton } from '../pmove/constants.js';

export interface UserCommand {
  readonly msec: number;
  readonly buttons: PlayerButton;
  readonly angles: Vec3;
  readonly forwardmove: number;
  readonly sidemove: number;
  readonly upmove: number;
  readonly serverFrame?: number;
  readonly sequence: number;
  readonly lightlevel: number;
  readonly impulse: number;
}

export interface MouseDelta {
  readonly deltaX: number;
  readonly deltaY: number;
}

export interface MouseLookOptions {
  readonly sensitivity: number;
  readonly invertY: boolean;
  readonly sensitivityX?: number;
  readonly sensitivityY?: number;
}

export const DEFAULT_FORWARD_SPEED = 200;
export const DEFAULT_SIDE_SPEED = 200;
export const DEFAULT_UP_SPEED = 200;
export const DEFAULT_YAW_SPEED = 140;
export const DEFAULT_PITCH_SPEED = 150;
export const DEFAULT_MOUSE_SENSITIVITY = 3;

function clampPitch(pitch: number): number {
  const normalized = angleMod(pitch);

  if (normalized > 89 && normalized < 180) return 89;
  if (normalized < 271 && normalized >= 180) return 271;

  return normalized;
}

export function addViewAngles(current: Vec3, delta: Vec3): Vec3 {
  return {
    x: clampPitch(current.x + delta.x),
    y: angleMod(current.y + delta.y),
    z: angleMod(current.z + delta.z),
  } satisfies Vec3;
}

export function mouseDeltaToViewDelta(delta: MouseDelta, options: MouseLookOptions): Vec3 {
  const yawScale = options.sensitivityX ?? options.sensitivity;
  const pitchScale = (options.sensitivityY ?? options.sensitivity) * (options.invertY ? -1 : 1);

  return {
    x: delta.deltaY * pitchScale,
    y: delta.deltaX * yawScale,
    z: 0,
  } satisfies Vec3;
}
