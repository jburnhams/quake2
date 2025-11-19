import { describe, expect, it } from 'vitest';
import {
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
} from '../src/bsp/contents.js';
import { ZERO_VEC3 } from '../src/math/vec3.js';
import { groundCurrentVelocity, currentVectorFromContents, waterCurrentVelocity } from '../src/pmove/currents.js';
import { WaterLevel, isAtLeastWaistDeep, isUnderwater } from '../src/pmove/constants.js';

describe('currents helpers', () => {
  it('keeps water level semantics aligned with the rerelease enum ordering', () => {
    expect(WaterLevel.None).toBe(0);
    expect(WaterLevel.Feet).toBe(1);
    expect(WaterLevel.Waist).toBe(2);
    expect(WaterLevel.Under).toBe(3);

    expect(isAtLeastWaistDeep(WaterLevel.None)).toBe(false);
    expect(isAtLeastWaistDeep(WaterLevel.Waist)).toBe(true);
    expect(isAtLeastWaistDeep(WaterLevel.Under)).toBe(true);

    expect(isUnderwater(WaterLevel.Under)).toBe(true);
    expect(isUnderwater(WaterLevel.Waist)).toBe(false);
  });

  it('builds direction vectors directly from CONTENTS_CURRENT bits', () => {
    expect(currentVectorFromContents(CONTENTS_CURRENT_0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(currentVectorFromContents(CONTENTS_CURRENT_180)).toEqual({ x: -1, y: 0, z: 0 });
    expect(currentVectorFromContents(CONTENTS_CURRENT_90)).toEqual({ x: 0, y: 1, z: 0 });
    expect(currentVectorFromContents(CONTENTS_CURRENT_270)).toEqual({ x: 0, y: -1, z: 0 });
    expect(currentVectorFromContents(CONTENTS_CURRENT_UP)).toEqual({ x: 0, y: 0, z: 1 });
    expect(currentVectorFromContents(CONTENTS_CURRENT_DOWN)).toEqual({ x: 0, y: 0, z: -1 });

    const diagonal =
      CONTENTS_CURRENT_0 |
      CONTENTS_CURRENT_90 |
      CONTENTS_CURRENT_DOWN;

    expect(currentVectorFromContents(diagonal)).toEqual({ x: 1, y: 1, z: -1 });
    expect(currentVectorFromContents(0)).toBe(ZERO_VEC3);
  });

  it('matches PM_WaterMove scaling including the feet-on-ground half speed', () => {
    const watertype = CONTENTS_CURRENT_0 | CONTENTS_CURRENT_DOWN;
    const speed = 400;

    const fullySubmerged = waterCurrentVelocity({
      watertype,
      waterlevel: WaterLevel.Under,
      onGround: false,
      waterSpeed: speed,
    });

    expect(fullySubmerged).toEqual({ x: speed, y: 0, z: -speed });

    const feetOnGround = waterCurrentVelocity({
      watertype,
      waterlevel: WaterLevel.Feet,
      onGround: true,
      waterSpeed: speed,
    });

    expect(feetOnGround).toEqual({ x: speed / 2, y: 0, z: -speed / 2 });

    const noCurrent = waterCurrentVelocity({
      watertype: 0,
      waterlevel: WaterLevel.Under,
      onGround: false,
      waterSpeed: speed,
    });

    expect(noCurrent).toBe(ZERO_VEC3);
  });

  it('applies ground conveyor currents with the rerelease scalar', () => {
    const groundContents = CONTENTS_CURRENT_180 | CONTENTS_CURRENT_90;
    const result = groundCurrentVelocity({ groundContents });

    expect(result).toEqual({ x: -100, y: 100, z: 0 });

    const custom = groundCurrentVelocity({ groundContents, scale: 32 });
    expect(custom).toEqual({ x: -32, y: 32, z: 0 });

    expect(groundCurrentVelocity({ groundContents: 0 })).toBe(ZERO_VEC3);
  });
});
