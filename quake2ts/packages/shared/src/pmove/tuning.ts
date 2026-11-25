/**
 * The constants player movement is tuned by, as one object so a caller can change them: the
 * explorer's movement lab puts each on a slider, and a mod could set its own. `runPmove` takes it
 * as an optional third argument; leaving it out (or any field of it) is the game as it ships.
 *
 * The defaults are the C values, rerelease/p_move.cpp:181-188 and qcommon/pmove.c:53-61.
 * `waterAccelerate` was 4 in the port until 2026-11-25; both C sources have 10.
 */
export interface PmoveTuning {
  /** pm_accelerate: ground acceleration, as a multiple of the wished speed per second. */
  readonly accelerate: number;
  /** pm_airaccelerate (sv_airaccelerate): acceleration in the air. */
  readonly airAccelerate: number;
  /** pm_wateraccelerate: acceleration when at least waist deep. */
  readonly waterAccelerate: number;
  /** pm_friction: ground friction. */
  readonly friction: number;
  /** pm_waterfriction: water friction, scaled by how deep the player is. */
  readonly waterFriction: number;
  /** pm_stopspeed: below this speed friction acts as if moving at it, so the player stops. */
  readonly stopSpeed: number;
  /** pm_maxspeed: the fastest a command can ask for, in units per second. */
  readonly maxSpeed: number;
  /** pm_duckspeed: the fastest a ducked player moves. */
  readonly duckSpeed: number;
  /** pm_waterspeed: the fastest a swimming player moves. */
  readonly waterSpeed: number;
  /** STEPSIZE: the highest step the player walks up without jumping, in units. */
  readonly stepSize: number;
  /** The upward speed a jump starts with (270 in p_move.cpp's PM_CheckJump). */
  readonly jumpSpeed: number;
}

/** The game as it ships. */
export const DEFAULT_PMOVE_TUNING: PmoveTuning = Object.freeze({
  accelerate: 10,
  airAccelerate: 1,
  waterAccelerate: 10,
  friction: 6,
  waterFriction: 1,
  stopSpeed: 100,
  maxSpeed: 300,
  duckSpeed: 100,
  waterSpeed: 400,
  stepSize: 18,
  jumpSpeed: 270,
});
