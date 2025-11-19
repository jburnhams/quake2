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
