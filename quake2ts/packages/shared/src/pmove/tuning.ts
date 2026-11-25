/**
 * The constants player movement is tuned by, as one object so a caller can change them: the
 * explorer's movement lab puts each on a slider, and a mod could set its own. `runPmove` takes it
 * as an optional third argument; leaving it out (or any field of it) is the game as it ships.
 *
 * The defaults are the C values, rerelease/p_move.cpp:181-188 and qcommon/pmove.c:53-61.
 * `waterAccelerate` was 4 in the port until 2026-11-25; both C sources have 10. `airAccelerate` was
 * 1 until the same day, which took PM_AirAccelerate's capped path; sv_airaccelerate is 0 in
 * g_main.cpp:312, so the game takes PM_Accelerate(wishdir, wishspeed, 1) in the air.
 */
export interface PmoveTuning {
  /** pm_accelerate: ground acceleration, as a multiple of the wished speed per second. */
  readonly accelerate: number;
  /**
   * pm_airaccelerate (sv_airaccelerate): acceleration in the air. 0, as the game ships, is not "no
   * air control": the air move then calls PM_Accelerate with an acceleration of 1. Above 0 it calls
   * PM_AirAccelerate with this value, which caps the speed added along the wish direction at 30
   * (QuakeWorld's and Half-Life's air control).
   */
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
  /** pm_config.n64_physics: no trick jumps or ducking, a landing pause after every fall. */
  readonly n64Physics?: boolean;
}

/** The game as it ships. */
export const DEFAULT_PMOVE_TUNING: PmoveTuning = Object.freeze({
  accelerate: 10,
  airAccelerate: 0,
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
