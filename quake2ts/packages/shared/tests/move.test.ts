import { describe, expect, it } from 'vitest';
import { PmFlag, PmType, PlayerButton, WaterLevel } from '../src/index.js';
import type { Vec3 } from '../src/index.js';
import type { PmoveTraceResult } from '../src/pmove/types.js';
import { applyPmoveAirMove, applyPmoveWaterMove } from '../src/pmove/move.js';

const mins: Vec3 = { x: -16, y: -16, z: -24 };
const maxs: Vec3 = { x: 16, y: 16, z: 32 };
const origin: Vec3 = { x: 0, y: 0, z: 0 };
const forward: Vec3 = { x: 1, y: 0, z: 0 };
const right: Vec3 = { x: 0, y: 1, z: 0 };

function identityTrace(_: Vec3, end: Vec3): PmoveTraceResult {
  return {
    fraction: 1,
    endpos: end,
    allsolid: false,
    startsolid: false,
  };
}

describe('applyPmoveAirMove', () => {
  it('accelerates along the ground and advances origin', () => {
    const result = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: true,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 0,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    expect(result.velocity.x).toBeCloseTo(200, 3);
    expect(result.origin.x).toBeCloseTo(20, 3);
    expect(result.origin.y).toBeCloseTo(0, 6);
    expect(result.stepped).toBe(true);
    expect(result.stepHeight).toBeCloseTo(18, 3);
  });

  it('short-circuits when no planar velocity remains on the ground', () => {
    const result = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: true,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 0,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    expect(result.origin).toEqual(origin);
    expect(result.stopped).toBe(true);
  });

  it('damps vertical velocity when clinging to ladders without vertical wish', () => {
    const result = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 200 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: PmFlag.OnLadder,
      onGround: false,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 0,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: true,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    expect(result.velocity.z).toBeLessThan(200);
    expect(result.velocity.z).toBeGreaterThanOrEqual(0);
  });

  it('uses custom air acceleration when airborne', () => {
    const boosted = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: false,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 2,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    const baseline = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: false,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 0,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    expect(boosted.velocity.x).toBeGreaterThan(baseline.velocity.x);
  });

  it('skips gravity for grapple movement', () => {
    const result = applyPmoveAirMove({
      origin,
      velocity: { x: 0, y: 0, z: 100 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: false,
      gravity: 800,
      pmType: PmType.Grapple,
      pmAccelerate: 10,
      pmAirAccelerate: 1,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 1,
      pmWaterSpeed: 400,
    });

    expect(result.velocity.z).toBeCloseTo(100, 5);
  });
});

describe('applyPmoveWaterMove', () => {
  it('drifts downward when idle and underwater', () => {
    const result = applyPmoveWaterMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: false,
      pmMaxSpeed: 320,
      pmDuckSpeed: 150,
      pmWaterAccelerate: 10,
      pmWaterSpeed: 400,
      onLadder: false,
      watertype: 0,
      groundContents: 0,
      waterlevel: WaterLevel.Under,
      viewPitch: 0,
      ladderMod: 1,
    });

    expect(result.velocity.z).toBeLessThan(0);
    expect(result.origin.z).toBeLessThan(0);
  });

  it('caps wishspeed at duckspeed when crouched', () => {
    const result = applyPmoveWaterMove({
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: identityTrace,
      cmd: { forwardmove: 400, sidemove: 0, upmove: 0, buttons: PlayerButton.Crouch },
      forward,
      right,
      pmFlags: PmFlag.Ducked,
      onGround: false,
      pmMaxSpeed: 320,
      pmDuckSpeed: 100,
      pmWaterAccelerate: 10,
      pmWaterSpeed: 400,
      onLadder: false,
      watertype: 0,
      groundContents: 0,
      waterlevel: WaterLevel.Under,
      viewPitch: 0,
      ladderMod: 1,
    });

    expect(Math.hypot(result.velocity.x, result.velocity.y)).toBeLessThanOrEqual(100);
  });
});
