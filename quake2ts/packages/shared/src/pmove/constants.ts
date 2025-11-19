/**
 * Mirrors the Quake II rerelease `water_level_t` enumeration from `game.h`
 * (lines 443-449). These numeric values are relied upon throughout the
 * movement code when checking how submerged a player is, so we keep the same
 * ordering to make future porting work straightforward.
 */
export enum WaterLevel {
  None = 0,
  Feet = 1,
  Waist = 2,
  Under = 3,
}

/**
 * Utility that matches the common rerelease checks that treat any level at or
 * above the `WATER_WAIST` constant as "significantly submerged" for friction
 * and current calculations.
 */
export function isAtLeastWaistDeep(level: WaterLevel): boolean {
  return level >= WaterLevel.Waist;
}

/**
 * Returns true when the player is considered underwater (the `WATER_UNDER`
 * case in the rerelease). This mirrors the places in `p_move.cpp` that gate
 * effects such as breath timers and screen warping.
 */
export function isUnderwater(level: WaterLevel): boolean {
  return level === WaterLevel.Under;
}

/**
 * Matches the Quake II rerelease `pmflags_t` bit layout from `game.h` so the
 * shared helpers can manipulate the same flag words as the authoritative game
 * and the client prediction layer.
 */
export const enum PmFlag {
  Ducked = 1 << 0,
  JumpHeld = 1 << 1,
  OnGround = 1 << 2,
  TimeWaterJump = 1 << 3,
  TimeLand = 1 << 4,
  TimeTeleport = 1 << 5,
  NoPositionalPrediction = 1 << 6,
  OnLadder = 1 << 7,
  NoAngularPrediction = 1 << 8,
  IgnorePlayerCollision = 1 << 9,
  TimeTrick = 1 << 10,
}

export type PmFlags = number;

export function hasPmFlag(flags: PmFlags, flag: PmFlag): boolean {
  return (flags & flag) !== 0;
}

export function addPmFlag(flags: PmFlags, flag: PmFlag): PmFlags {
  return flags | flag;
}

export function removePmFlag(flags: PmFlags, flag: PmFlag): PmFlags {
  return flags & ~flag;
}

/**
 * Player movement types mirrored from the rerelease `pmtype_t` enumeration.
 * The exact numeric values matter when syncing pmove state across the network
 * so we keep the same order as the C++ definition.
 */
export enum PmType {
  Normal = 0,
  Grapple = 1,
  NoClip = 2,
  Spectator = 3,
  Dead = 4,
  Gib = 5,
  Freeze = 6,
}

/**
 * Bitmask constants for the `buttons` field on the Quake II player command
 * structure. These mirror the rerelease `BUTTON_*` definitions so logic such as
 * jump/crouch checks can be shared between the server and client.
 */
export const enum PlayerButton {
  None = 0,
  Attack = 1 << 0,
  Use = 1 << 1,
  Holster = 1 << 2,
  Jump = 1 << 3,
  Crouch = 1 << 4,
  Any = 1 << 7,
}
