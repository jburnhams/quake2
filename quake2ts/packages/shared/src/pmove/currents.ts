import type { ContentsFlag } from '../bsp/contents.js';
import {
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
  MASK_CURRENT,
} from '../bsp/contents.js';
import { ZERO_VEC3, scaleVec3, type Vec3 } from '../math/vec3.js';
import { WaterLevel } from './constants.js';

export interface WaterCurrentParams {
  readonly watertype: ContentsFlag;
  readonly waterlevel: WaterLevel;
  readonly onGround: boolean;
  readonly waterSpeed: number;
}

export interface GroundCurrentParams {
  readonly groundContents: ContentsFlag;
  readonly scale?: number;
}

const DEFAULT_GROUND_CURRENT_SCALE = 100;

/**
 * Mirrors the rerelease pattern in `p_move.cpp` (lines 730-765) that turns the
 * directional CONTENTS_CURRENT_* flags into a unit-ish direction vector.
 */
export function currentVectorFromContents(contents: ContentsFlag): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;

  if (contents & CONTENTS_CURRENT_0) {
    x += 1;
  }
  if (contents & CONTENTS_CURRENT_90) {
    y += 1;
  }
  if (contents & CONTENTS_CURRENT_180) {
    x -= 1;
  }
  if (contents & CONTENTS_CURRENT_270) {
    y -= 1;
  }
  if (contents & CONTENTS_CURRENT_UP) {
    z += 1;
  }
  if (contents & CONTENTS_CURRENT_DOWN) {
    z -= 1;
  }

  if (x === 0 && y === 0 && z === 0) {
    return ZERO_VEC3;
  }

  return { x, y, z };
}

/**
 * Computes the velocity contribution from water currents using the same rules
 * as `PM_WaterMove`: the CONTENTS_CURRENT_* bits are turned into a direction
 * vector, scaled by `pm_waterspeed`, and halved when the player only has their
 * feet submerged while standing on solid ground.
 */
export function waterCurrentVelocity(params: WaterCurrentParams): Vec3 {
  const { watertype, waterlevel, onGround, waterSpeed } = params;

  if ((watertype & MASK_CURRENT) === 0) {
    return ZERO_VEC3;
  }

  const direction = currentVectorFromContents(watertype);
  if (direction === ZERO_VEC3) {
    return ZERO_VEC3;
  }

  let scale = waterSpeed;
  if (waterlevel === WaterLevel.Feet && onGround) {
    scale *= 0.5;
  }

  return scaleVec3(direction, scale);
}

/**
 * Computes the conveyor-style velocity that should be applied while touching a
 * ground plane that carries CONTENTS_CURRENT_* bits. The rerelease multiplies
 * the direction vector by 100 units per second, so we expose the same default
 * while allowing callers to override the scalar for tests.
 */
export function groundCurrentVelocity(params: GroundCurrentParams): Vec3 {
  const { groundContents, scale = DEFAULT_GROUND_CURRENT_SCALE } = params;

  const direction = currentVectorFromContents(groundContents);
  if (direction === ZERO_VEC3) {
    return ZERO_VEC3;
  }

  return scaleVec3(direction, scale);
}
