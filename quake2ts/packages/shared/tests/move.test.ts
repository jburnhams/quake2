import { describe, expect, it } from 'vitest';
import { PmFlag, PmType, PlayerButton, WaterLevel } from '../src/index.js';
import type { Vec3 } from '../src/index.js';
import type { PmoveTraceResult, PmoveTraceFn } from '../src/pmove/types.js';
import { applyPmoveAirMove, applyPmoveWaterMove } from '../src/pmove/move.js';
import { stairTrace, ladderTrace } from './test-helpers.js';

const mins: Vec3 = { x: -16, y: -16, z: -24 };
const maxs: Vec3 = { x: 16, y: 16, z: 32 };
const origin: Vec3 = { x: 0, y: 0, z: 0 };
const forward: Vec3 = { x: 1, y: 0, z: 0 };
const right: Vec3 = { x: 0, y: 1, z: 0 };
const wallNormal: Vec3 = { x: -1, y: 0, z: 0 };

function identityTrace(_: Vec3, end: Vec3): PmoveTraceResult {
  return {
    fraction: 1,
    endpos: end,
    allsolid: false,
    startsolid: false,
  };
}

function forwardWallTrace(start: Vec3, end: Vec3): PmoveTraceResult {
  if (end.z !== start.z) {
    return {
      fraction: 1,
      endpos: end,
      allsolid: false,
      startsolid: false,
    };
  }

  if (end.x > start.x) {
    return {
      fraction: 0,
      endpos: start,
      allsolid: false,
      startsolid: false,
      planeNormal: wallNormal,
    };
  }

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

  it('defaults to the Quake II overbounce constant when omitted', () => {
    const result = applyPmoveAirMove({
      origin,
      velocity: { x: 200, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: forwardWallTrace,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      right,
      pmFlags: 0,
      onGround: false,
      gravity: 0,
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

    expect(result.velocity.x).toBe(0);
    expect(result.blocked).not.toBe(0);
  });

  it('should step up a single stair', () => {
    const params = {
      origin: { x: -10, y: 0, z: 0 },
      velocity: { x: 100, y: 0, z: 0 },
      frametime: 0.1,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace: stairTrace,
      cmd: { forwardmove: 100, sidemove: 0, upmove: 0 },
      forward: { x: 1, y: 0, z: 0 },
      right: { x: 0, y: 1, z: 0 },
      pmFlags: 0,
      onGround: true,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmMaxSpeed: 320,
      pmDuckSpeed: 100,
      onLadder: false,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 0.5,
      pmWaterSpeed: 400,
    };

    const result = applyPmoveAirMove(params);

    expect(result.origin.x).toBeGreaterThan(params.origin.x);
    expect(result.origin.z).toBeGreaterThan(0);
  });

  it('should move up and down a ladder', () => {
    const baseParams = {
      origin: { x: 2, y: 0, z: 10 },
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace: ladderTrace,
      forward: { x: 1, y: 0, z: 0 },
      right: { x: 0, y: 1, z: 0 },
      pmFlags: PmFlag.OnLadder,
      onGround: false,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmMaxSpeed: 320,
      pmDuckSpeed: 100,
      onLadder: true,
      waterlevel: WaterLevel.None,
      watertype: 0,
      groundContents: 0,
      viewPitch: 0,
      ladderMod: 0.5,
      pmWaterSpeed: 400,
    };

    // Move up
    const upResult = applyPmoveAirMove({
      ...baseParams,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 100, buttons: PlayerButton.Jump },
    });

    expect(upResult.origin.z).toBeGreaterThan(baseParams.origin.z);

    // Move down
    const downResult = applyPmoveAirMove({
      ...baseParams,
      cmd: { forwardmove: 0, sidemove: 0, upmove: -100, buttons: PlayerButton.Crouch },
    });

    expect(downResult.origin.z).toBeLessThan(baseParams.origin.z);
  });
});

describe('applyPmoveWaterMove', () => {
  it('should have reduced speed in water', () => {
    const params = {
      origin: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      frametime: 0.1,
      mins: { x: -16, y: -16, z: -24 },
      maxs: { x: 16, y: 16, z: 32 },
      trace: identityTrace,
      cmd: { forwardmove: 100, sidemove: 0, upmove: 0 },
      forward: { x: 1, y: 0, z: 0 },
      right: { x: 0, y: 1, z: 0 },
      pmFlags: 0,
      onGround: true,
      pmMaxSpeed: 320,
      pmDuckSpeed: 100,
      pmWaterAccelerate: 10,
      pmWaterSpeed: 400,
      onLadder: false,
      watertype: 0,
      groundContents: 0,
      waterlevel: WaterLevel.Waist,
      viewPitch: 0,
      ladderMod: 1,
    };

    const result = applyPmoveWaterMove(params);

    // Compare with ground movement (not airborne) which uses same acceleration
    const groundParams = {
      ...params,
      waterlevel: WaterLevel.None,
      gravity: 800,
      pmType: PmType.Normal,
      pmAccelerate: 10,
      pmAirAccelerate: 0,
    };
    const groundResult = applyPmoveAirMove(groundParams);

    // Water movement should be slower due to wishspeed *= 0.5 in water
    expect(result.velocity.x).toBeLessThan(groundResult.velocity.x);
  });
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

  it('defaults the overbounce constant before resolving collisions', () => {
    const result = applyPmoveWaterMove({
      origin,
      velocity: { x: 200, y: 0, z: 0 },
      frametime: 0.1,
      mins,
      maxs,
      trace: forwardWallTrace,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: 0 },
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
      waterlevel: WaterLevel.Waist,
      viewPitch: 0,
      ladderMod: 1,
    });

    expect(result.velocity.x).toBe(0);
    expect(result.blocked).not.toBe(0);
  });

});

describe('stairTrace edge cases', () => {
  const testMins: Vec3 = { x: -16, y: -16, z: -24 };
  const testMaxs: Vec3 = { x: 16, y: 16, z: 32 };

  it('should clamp fraction to [0, 1] when landing on step from above', () => {
    // Player at z=18 trying to drop to z=0, should land on step at z=8
    const start: Vec3 = { x: 5, y: 0, z: 18 };
    const end: Vec3 = { x: 5, y: 0, z: 0 };

    const result = stairTrace(start, end, testMins, testMaxs);

    // Fraction should be in valid range [0, 1]
    expect(result.fraction).toBeGreaterThanOrEqual(0);
    expect(result.fraction).toBeLessThanOrEqual(1);

    // Should land on step surface (z=8 with mins.z=-24 means origin at z=32)
    expect(result.endpos.z).toBeGreaterThanOrEqual(start.z);
    expect(result.endpos.z).toBeLessThanOrEqual(32); // STEP_HEIGHT - mins.z = 8 - (-24) = 32
  });

  it('should not produce negative fractions when descending onto step', () => {
    // Various descent scenarios
    const testCases = [
      { start: { x: 10, y: 0, z: 20 }, end: { x: 10, y: 0, z: 0 } },
      { start: { x: 10, y: 0, z: 18 }, end: { x: 10, y: 0, z: -5 } },
      { start: { x: 10, y: 0, z: 15 }, end: { x: 10, y: 0, z: 0 } },
      { start: { x: 10, y: 0, z: 10 }, end: { x: 10, y: 0, z: 0 } },
    ];

    for (const { start, end } of testCases) {
      const result = stairTrace(start, end, testMins, testMaxs);

      expect(result.fraction).toBeGreaterThanOrEqual(0);
      expect(result.fraction).toBeLessThanOrEqual(1);

      // endpos should be between start and end (or at one of them)
      expect(result.endpos.z).toBeLessThanOrEqual(Math.max(start.z, end.z));
      expect(result.endpos.z).toBeGreaterThanOrEqual(Math.min(start.z, end.z));
    }
  });

  it('should handle descent from below step height correctly', () => {
    // Player already below step, descending further
    const start: Vec3 = { x: 10, y: 0, z: 5 };
    const end: Vec3 = { x: 10, y: 0, z: 0 };

    const result = stairTrace(start, end, testMins, testMaxs);

    expect(result.fraction).toBeGreaterThanOrEqual(0);
    expect(result.fraction).toBeLessThanOrEqual(1);
  });

  it('should handle horizontal movement at step height correctly', () => {
    // Moving horizontally at exactly step height
    const start: Vec3 = { x: 5, y: 0, z: 8 };
    const end: Vec3 = { x: 15, y: 0, z: 8 };

    const result = stairTrace(start, end, testMins, testMaxs);

    expect(result.fraction).toBeGreaterThanOrEqual(0);
    expect(result.fraction).toBeLessThanOrEqual(1);
  });

  it('should produce endpos on the ray between start and end', () => {
    // When fraction < 1, endpos must be on the line segment
    const start: Vec3 = { x: 10, y: 5, z: 20 };
    const end: Vec3 = { x: 10, y: 5, z: 0 };

    const result = stairTrace(start, end, testMins, testMaxs);

    if (result.fraction < 1.0) {
      // Check that endpos is on the line segment
      const t = result.fraction;
      const expectedX = start.x + t * (end.x - start.x);
      const expectedY = start.y + t * (end.y - start.y);
      const expectedZ = start.z + t * (end.z - start.z);

      // Allow for floating point imprecision
      expect(result.endpos.x).toBeCloseTo(expectedX, 5);
      expect(result.endpos.y).toBeCloseTo(expectedY, 5);
      expect(result.endpos.z).toBeCloseTo(expectedZ, 5);
    }
  });

  it('should handle floor landing with proper fractions', () => {
    // Player descending to floor from above (before step area)
    // With mins.z = -24, the bbox bottom is at z + mins.z
    // To start above floor (z=0), we need start.z + mins.z > 0, so start.z > 24
    const start: Vec3 = { x: -20, y: 0, z: 30 };
    const end: Vec3 = { x: -20, y: 0, z: 0 };

    const result = stairTrace(start, end, testMins, testMaxs);

    expect(result.fraction).toBeGreaterThanOrEqual(0);
    expect(result.fraction).toBeLessThanOrEqual(1);

    // Should land on floor when bbox bottom (start.z + mins.z) hits z=0
    // That means origin should be at z=24 when landing
    if (result.fraction < 1.0) {
      expect(result.endpos.z).toBeCloseTo(24, 5); // -mins.z = -(-24) = 24
      // Verify fraction is correct: bbox bottom should be at z=0
      expect(result.endpos.z + testMins.z).toBeCloseTo(0, 5);
    }
  });
});
