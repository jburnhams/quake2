import { describe, expect, it } from 'vitest';
import {
  CONTENTS_NONE,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  WaterLevel,
  getWaterLevel,
  type Vec3,
} from '../src/index.js';

const ORIGIN = { x: 0, y: 0, z: 64 } as const;
const STANDING_MINS = { x: -16, y: -16, z: -24 } as const;
const STANDING_VIEWHEIGHT = 22;

function makePointContents(surfaceZ: number, type = CONTENTS_WATER) {
  return (point: Vec3) => (point.z < surfaceZ ? type : CONTENTS_NONE);
}

function standingSampleZ(offset: number) {
  return ORIGIN.z + STANDING_MINS.z + offset;
}

describe('getWaterLevel', () => {
  it('returns none when no sample point is submerged', () => {
    const result = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: () => CONTENTS_NONE,
    });

    expect(result).toEqual({ waterlevel: WaterLevel.None, watertype: CONTENTS_NONE });
  });

  it('classifies feet, waist, and under levels based on the probe depth', () => {
    const footSurface = standingSampleZ(20); // between the feet sample (+1) and waist sample (~23)
    const waistSurface = standingSampleZ(45); // between waist and viewheight samples
    const submergedSurface = standingSampleZ(60); // above every sample point

    const feetOnly = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: makePointContents(footSurface),
    });

    expect(feetOnly.waterlevel).toBe(WaterLevel.Feet);
    expect(feetOnly.watertype).toBe(CONTENTS_WATER);

    const waistDeep = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: makePointContents(waistSurface),
    });

    expect(waistDeep.waterlevel).toBe(WaterLevel.Waist);

    const underwater = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: makePointContents(submergedSurface),
    });

    expect(underwater.waterlevel).toBe(WaterLevel.Under);
  });

  it('preserves the contents mask from the feet sample', () => {
    const result = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: makePointContents(standingSampleZ(60), CONTENTS_SLIME),
    });

    expect(result.watertype).toBe(CONTENTS_SLIME);
  });

  it('accounts for ducking by shrinking the sampled height', () => {
    const DUCK_MINS = { x: -16, y: -16, z: -8 };
    const DUCK_VIEWHEIGHT = 12;
    const surfaceZ = standingSampleZ(15); // feet are wet while standing

    const standing = getWaterLevel({
      origin: ORIGIN,
      mins: STANDING_MINS,
      viewheight: STANDING_VIEWHEIGHT,
      pointContents: makePointContents(surfaceZ),
    });

    expect(standing.waterlevel).toBe(WaterLevel.Feet);

    const ducked = getWaterLevel({
      origin: ORIGIN,
      mins: DUCK_MINS,
      viewheight: DUCK_VIEWHEIGHT,
      pointContents: makePointContents(surfaceZ),
    });

    expect(ducked.waterlevel).toBe(WaterLevel.None);
  });
});
