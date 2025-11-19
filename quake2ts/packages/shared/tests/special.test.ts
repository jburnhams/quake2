import { describe, expect, it } from 'vitest';
import {
  CONTENTS_LADDER,
  CONTENTS_NO_WATERJUMP,
  CONTENTS_NONE,
  CONTENTS_SOLID,
  CONTENTS_WATER,
  PlayerButton,
  PmFlag,
  WaterLevel,
  addVec3,
  checkSpecialMovement,
  hasPmFlag,
  scaleVec3,
  type Vec3,
} from '../src/index.js';
import type { PmoveTraceResult } from '../src/pmove/types.js';

const mins: Vec3 = { x: -16, y: -16, z: -24 };
const maxs: Vec3 = { x: 16, y: 16, z: 32 };
const origin: Vec3 = { x: 0, y: 0, z: 0 };
const forward: Vec3 = { x: 1, y: 0, z: 0 };
const viewheight = 22;

function ladderTrace(start: Vec3, end: Vec3): PmoveTraceResult {
  const delta = addVec3(end, { x: -start.x, y: -start.y, z: -start.z });
  if (Math.abs(delta.x) <= 1.01 && Math.abs(delta.y) < 0.01 && Math.abs(delta.z) < 0.01) {
    return {
      fraction: 0.5,
      endpos: addVec3(start, scaleVec3(delta, 0.5)),
      allsolid: false,
      startsolid: false,
      contents: CONTENTS_LADDER,
      planeNormal: { x: -1, y: 0, z: 0 },
    };
  }
  return { fraction: 1, endpos: end, allsolid: false, startsolid: false };
}

describe('checkSpecialMovement', () => {
  it('adds the ladder flag when brushing CONTENTS_LADDER while shallow in water', () => {
    const result = checkSpecialMovement({
      pmFlags: 0,
      pmTime: 0,
      waterlevel: WaterLevel.Feet,
      watertype: CONTENTS_NONE,
      gravity: 800,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      mins,
      maxs,
      viewheight,
      trace: ladderTrace,
      pointContents: () => CONTENTS_NONE,
      onGround: false,
    });

    expect(hasPmFlag(result.pmFlags, PmFlag.OnLadder)).toBe(true);
    expect(result.performedWaterJump).toBe(false);
  });

  it('clears the ladder flag when waist deep in water even if a ladder is present', () => {
    const result = checkSpecialMovement({
      pmFlags: PmFlag.OnLadder,
      pmTime: 0,
      waterlevel: WaterLevel.Waist,
      watertype: CONTENTS_WATER,
      gravity: 800,
      cmd: { forwardmove: 0, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      mins,
      maxs,
      viewheight,
      trace: ladderTrace,
      pointContents: () => CONTENTS_WATER,
      onGround: false,
    });

    expect(hasPmFlag(result.pmFlags, PmFlag.OnLadder)).toBe(false);
    expect(result.performedWaterJump).toBe(false);
  });

  it('simulates the water jump probe before granting the upward velocity boost', () => {
    const trace = createWaterJumpTrace();
    const result = checkSpecialMovement({
      pmFlags: 0,
      pmTime: 0,
      waterlevel: WaterLevel.Waist,
      watertype: CONTENTS_WATER,
      gravity: 800,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: 0 },
      forward,
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      mins,
      maxs,
      viewheight,
      trace,
      pointContents: dryLandingContents,
      onGround: false,
    });

    expect(result.performedWaterJump).toBe(true);
    expect(result.pmTime).toBe(2048);
    expect(hasPmFlag(result.pmFlags, PmFlag.TimeWaterJump)).toBe(true);
    expect(result.velocity.x).toBeCloseTo(50, 5);
    expect(result.velocity.z).toBe(350);
  });

  it('blocks water jumps when the watertype forbids them', () => {
    const trace = createWaterJumpTrace();
    const result = checkSpecialMovement({
      pmFlags: 0,
      pmTime: 0,
      waterlevel: WaterLevel.Waist,
      watertype: CONTENTS_WATER | CONTENTS_NO_WATERJUMP,
      gravity: 800,
      cmd: { forwardmove: 200, sidemove: 0, upmove: 0, buttons: PlayerButton.Jump },
      forward,
      origin,
      velocity: { x: 0, y: 0, z: 0 },
      mins,
      maxs,
      viewheight,
      trace,
      pointContents: dryLandingContents,
      onGround: false,
    });

    expect(result.performedWaterJump).toBe(false);
    expect(result.pmTime).toBe(0);
    expect(hasPmFlag(result.pmFlags, PmFlag.TimeWaterJump)).toBe(false);
  });
});

function createWaterJumpTrace(): (start: Vec3, end: Vec3) => PmoveTraceResult {
  return (start, end) => {
    const delta = {
      x: end.x - start.x,
      y: end.y - start.y,
      z: end.z - start.z,
    } satisfies Vec3;

    if (Math.abs(delta.x - 40) < 0.01 && Math.abs(delta.y) < 0.01 && Math.abs(delta.z) < 0.01) {
      return {
        fraction: 0.2,
        endpos: { x: start.x + delta.x * 0.2, y: start.y, z: start.z },
        planeNormal: { x: -1, y: 0, z: 0 },
        contents: CONTENTS_SOLID,
        allsolid: false,
        startsolid: false,
      };
    }

    if (delta.z < 0 && Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01) {
      return {
        fraction: 0.5,
        endpos: { x: start.x, y: start.y, z: Math.max(start.z - 1, 2) },
        planeNormal: { x: 0, y: 0, z: 1 },
        contents: CONTENTS_SOLID,
        allsolid: false,
        startsolid: false,
      };
    }

    return { fraction: 1, endpos: end, allsolid: false, startsolid: false };
  };
}

function dryLandingContents(point: Vec3): number {
  return point.z > 1 ? CONTENTS_NONE : CONTENTS_WATER;
}
