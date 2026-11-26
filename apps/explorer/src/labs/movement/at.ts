// Where each player is at the movement lab's playhead: between the two recorded frames either side
// of it, so the run plays smoothly at any speed. Pure, so the tests check it without a clock.
import { FRAME_MSEC, RUN_FRAMES, type MovementFrame } from './simulate';

type Vec = { readonly x: number; readonly y: number; readonly z: number };

/** The run's length in seconds. */
export const RUN_SECONDS = (RUN_FRAMES * FRAME_MSEC) / 1000;
/** One frame, in seconds. */
export const FRAME_SECONDS = FRAME_MSEC / 1000;

/** Where the player is `t` seconds in; the start before the first frame. */
export function frameAt(frames: readonly MovementFrame[], start: Vec, t: number): { origin: Vec; distance: number } {
  if (frames.length === 0) return { origin: start, distance: 0 };
  const at = Math.min(Math.max(t / FRAME_SECONDS, 0), frames.length);
  const i = Math.min(Math.floor(at), frames.length - 1);
  const after = frames[i]!;
  const before = i === 0 ? { origin: start, distance: 0 } : frames[i - 1]!;
  const k = Math.min(at - i, 1);
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    origin: { x: mix(before.origin.x, after.origin.x), y: mix(before.origin.y, after.origin.y), z: mix(before.origin.z, after.origin.z) },
    distance: mix(before.distance, after.distance),
  };
}
