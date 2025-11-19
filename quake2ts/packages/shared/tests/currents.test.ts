import { describe, expect, it } from 'vitest';
import {
  CONTENTS_CURRENT_0,
  CONTENTS_CURRENT_180,
  CONTENTS_CURRENT_270,
  CONTENTS_CURRENT_90,
  CONTENTS_CURRENT_DOWN,
  CONTENTS_CURRENT_UP,
  CONTENTS_LADDER,
} from '../src/bsp/contents.js';
import { ZERO_VEC3 } from '../src/math/vec3.js';
import {
  applyPmoveAddCurrents,
  groundCurrentVelocity,
  currentVectorFromContents,
  waterCurrentVelocity,
} from '../src/pmove/currents.js';
import { PlayerButton, WaterLevel, isAtLeastWaistDeep, isUnderwater } from '../src/pmove/constants.js';
import type { AddCurrentsParams } from '../src/pmove/currents.js';
import type { PmoveCmd, PmoveTraceResult } from '../src/pmove/types.js';

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

  describe('applyPmoveAddCurrents', () => {
    const baseCmd: PmoveCmd = { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 };
    const baseVector = { x: 1, y: 2, z: 3 };
    const playerMins = { x: -16, y: -16, z: -24 };
    const playerMaxs = { x: 16, y: 16, z: 32 };
    const origin = { x: 0, y: 0, z: 0 };
    const forward = { x: 1, y: 0, z: 0 };

    const ladderTraceResult: PmoveTraceResult = {
      fraction: 0,
      endpos: origin,
      allsolid: false,
      startsolid: false,
      planeNormal: { x: 1, y: 0, z: 0 },
      contents: CONTENTS_LADDER,
    };

    const baseParams: AddCurrentsParams = {
      wishVelocity: baseVector,
      onLadder: true,
      onGround: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      cmd: baseCmd,
      viewPitch: 0,
      maxSpeed: 300,
      ladderMod: 0.5,
      waterSpeed: 400,
      forward,
      origin,
      mins: playerMins,
      maxs: playerMaxs,
      trace: () => ladderTraceResult,
    };

    const apply = (overrides: Partial<AddCurrentsParams> & { cmd?: Partial<PmoveCmd> } = {}) =>
      applyPmoveAddCurrents({
        ...baseParams,
        ...overrides,
        cmd: { ...baseCmd, ...(overrides.cmd ?? {}) },
        trace: overrides.trace ?? baseParams.trace,
      });

    it('applies ladder jump/crouch speeds and underwater scaling', () => {
      const jump = apply({ waterlevel: WaterLevel.Under, cmd: { buttons: PlayerButton.Jump } });
      expect(jump.z).toBe(baseParams.maxSpeed);

      const crouch = apply({ waterlevel: WaterLevel.Feet, cmd: { buttons: PlayerButton.Crouch } });
      expect(crouch.z).toBe(-200);
    });

    it('clamps forward/back ladder movement based on pitch and zeros planar speed when backing down', () => {
      const climb = apply({ cmd: { forwardmove: 400 } });
      expect(climb.z).toBe(200);

      const descend = apply({ viewPitch: 20, cmd: { forwardmove: 400 } });
      expect(descend.z).toBe(-200);

      const reverse = apply({ cmd: { forwardmove: -400 } });
      expect(reverse.z).toBe(-200);
      expect(reverse.x).toBe(0);
      expect(reverse.y).toBe(0);
    });

    it('routes sidemove input along the ladder plane and scales by the ladder modifier in shallow water', () => {
      const deepWater = apply({ waterlevel: WaterLevel.Under, cmd: { sidemove: 200 } });
      expect(deepWater.y).toBeCloseTo(150, 4);

      const shallowWater = apply({ waterlevel: WaterLevel.Feet, cmd: { sidemove: 200 } });
      expect(shallowWater.y).toBeCloseTo(75, 4);
    });

    it('clamps planar velocity when idling on a ladder without sidemove', () => {
      const idle = apply({ wishVelocity: { x: 60, y: -80, z: 0 }, cmd: { sidemove: 0 } });
      expect(idle.x).toBe(25);
      expect(idle.y).toBe(-25);
    });

    it('adds water and ground currents after ladder adjustments', () => {
      const wish = { x: 0, y: 0, z: 0 };
      const result = apply({
        wishVelocity: wish,
        onLadder: false,
        onGround: true,
        watertype: CONTENTS_CURRENT_0,
        groundContents: CONTENTS_CURRENT_90,
      });

      expect(result).toEqual({ x: baseParams.waterSpeed, y: 100, z: 0 });
      expect(wish).toEqual({ x: 0, y: 0, z: 0 });
    });
  });
});
