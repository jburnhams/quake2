import { MASK_WATER, CONTENTS_NONE, type ContentsFlag } from '../bsp/contents.js';
import type { Vec3 } from '../math/vec3.js';
import { WaterLevel } from './constants.js';
import type { PmovePointContentsFn } from './types.js';

export interface WaterLevelParams {
  readonly origin: Vec3;
  readonly mins: Vec3;
  readonly viewheight: number;
  readonly pointContents: PmovePointContentsFn;
}

export interface WaterLevelResult {
  readonly waterlevel: WaterLevel;
  readonly watertype: ContentsFlag;
}

/**
 * Mirrors the rerelease `PM_GetWaterLevel` helper: probes the player's feet,
 * waist, and viewheight to determine how submerged they are and returns both
 * the enum level plus the contents bits encountered at the lowest sample.
 */
export function getWaterLevel(params: WaterLevelParams): WaterLevelResult {
  const { origin, mins, viewheight, pointContents } = params;

  const sample2 = viewheight - mins.z;
  const sample1 = sample2 / 2;

  const point: Vec3 = {
    x: origin.x,
    y: origin.y,
    z: origin.z + mins.z + 1,
  };

  let contents = pointContents(point);
  if ((contents & MASK_WATER) === 0) {
    return { waterlevel: WaterLevel.None, watertype: CONTENTS_NONE };
  }

  const watertype = contents;
  let waterlevel = WaterLevel.Feet;

  let point2: Vec3 = { x: point.x, y: point.y, z: origin.z + mins.z + sample1 };
  contents = pointContents(point2);
  if ((contents & MASK_WATER) !== 0) {
    waterlevel = WaterLevel.Waist;

    let point3: Vec3 = { x: point.x, y: point.y, z: origin.z + mins.z + sample2 };
    contents = pointContents(point3);
    if ((contents & MASK_WATER) !== 0) {
      waterlevel = WaterLevel.Under;
    }
  }

  return { waterlevel, watertype };
}
