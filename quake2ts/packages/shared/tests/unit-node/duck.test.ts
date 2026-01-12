import { describe, expect, it } from 'vitest';
import {
  MASK_SOLID,
  MASK_WATER,
  PlayerButton,
  PmFlag,
  PmType,
  WaterLevel,
  checkDuckState,
  computePlayerDimensions,
  type DuckTraceFn,
} from '../../src/index.js';
import type { Vec3 } from '../../src/math/vec3.js';
import type { PmoveTraceResult } from '../../src/pmove/types.js';

const ORIGIN: Vec3 = { x: 0, y: 0, z: 32 };
const MINS: Vec3 = { x: -16, y: -16, z: -24 };
const MAXS: Vec3 = { x: 16, y: 16, z: 32 };

interface TraceConfig {
  readonly duckBlocked?: boolean;
  readonly standBlocked?: boolean;
  readonly solidBelow?: boolean;
  readonly waterBelow?: boolean;
}

function createTrace(config: TraceConfig = {}): DuckTraceFn {
  const {
    duckBlocked = false,
    standBlocked = false,
    solidBelow = false,
    waterBelow = false,
  } = config;

  return ({ start, end, maxs, mask }) => {
    if (end !== start) {
      if (mask === MASK_SOLID) {
        return traceResult(solidBelow ? 0 : 1, end, false);
      }
      if (mask === MASK_WATER) {
        return traceResult(waterBelow ? 0 : 1, end, false);
      }
    }

    if (mask === MASK_SOLID && maxs.z === 4) {
      return traceResult(1, start, duckBlocked);
    }

    if (mask === MASK_SOLID && maxs.z === 32) {
      return traceResult(1, start, standBlocked);
    }

    return traceResult(1, end, false);
  };
}

function traceResult(fraction: number, endpos: Vec3, allsolid: boolean): PmoveTraceResult {
  return { fraction, endpos, startsolid: allsolid, allsolid } satisfies PmoveTraceResult;
}

describe('computePlayerDimensions', () => {
  it('mirrors the PM_SetDimensions cases for standing, ducked, dead, and gib states', () => {
    const standing = computePlayerDimensions(PmType.Normal, 0);
    expect(standing.mins).toEqual({ x: -16, y: -16, z: -24 });
    expect(standing.maxs).toEqual({ x: 16, y: 16, z: 32 });
    expect(standing.viewheight).toBe(22);

    const ducked = computePlayerDimensions(PmType.Normal, PmFlag.Ducked);
    expect(ducked.maxs.z).toBe(4);
    expect(ducked.viewheight).toBe(-2);

    const dead = computePlayerDimensions(PmType.Dead, 0);
    expect(dead.maxs.z).toBe(4);
    expect(dead.viewheight).toBe(-2);

    const gib = computePlayerDimensions(PmType.Gib, 0);
    expect(gib.mins).toEqual({ x: -16, y: -16, z: 0 });
    expect(gib.maxs).toEqual({ x: 16, y: 16, z: 16 });
    expect(gib.viewheight).toBe(8);
  });
});

describe('checkDuckState', () => {
  it('enters crouch when the button is held, ground exists, and there is headroom to crouch', () => {
    const result = checkDuckState({
      pmType: PmType.Normal,
      pmFlags: 0,
      buttons: PlayerButton.Crouch,
      waterlevel: WaterLevel.None,
      hasGroundEntity: true,
      onLadder: false,
      n64Physics: false,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace(),
    });

    expect(result.pmFlags & PmFlag.Ducked).not.toBe(0);
    expect(result.ducked).toBe(true);
    expect(result.maxs.z).toBe(4);
    expect(result.changed).toBe(true);
  });

  it('ignores crouch input when the N64 physics mode is enabled', () => {
    const result = checkDuckState({
      pmType: PmType.Normal,
      pmFlags: 0,
      buttons: PlayerButton.Crouch,
      waterlevel: WaterLevel.None,
      hasGroundEntity: true,
      onLadder: false,
      n64Physics: true,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace(),
    });

    expect(result.ducked).toBe(false);
    expect(result.changed).toBe(false);
  });

  it('forces ducked flags when the player is dead', () => {
    const result = checkDuckState({
      pmType: PmType.Dead,
      pmFlags: 0,
      buttons: 0,
      waterlevel: WaterLevel.None,
      hasGroundEntity: false,
      onLadder: false,
      n64Physics: false,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace(),
    });

    expect(result.ducked).toBe(true);
    expect(result.pmFlags & PmFlag.Ducked).not.toBe(0);
    expect(result.maxs.z).toBe(4);
  });

  it('won\'t crouch midair when only shallow water is under the player', () => {
    const result = checkDuckState({
      pmType: PmType.Normal,
      pmFlags: 0,
      buttons: PlayerButton.Crouch,
      waterlevel: WaterLevel.Feet,
      hasGroundEntity: false,
      onLadder: false,
      n64Physics: false,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace({ waterBelow: true }),
    });

    expect(result.ducked).toBe(false);
  });

  it('stands back up when crouch is released and headroom is clear', () => {
    const result = checkDuckState({
      pmType: PmType.Normal,
      pmFlags: PmFlag.Ducked,
      buttons: 0,
      waterlevel: WaterLevel.None,
      hasGroundEntity: true,
      onLadder: false,
      n64Physics: false,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace(),
    });

    expect(result.ducked).toBe(false);
    expect(result.changed).toBe(true);
    expect(result.maxs.z).toBe(32);
  });

  it('remains crouched when the stand-up trace is blocked', () => {
    const result = checkDuckState({
      pmType: PmType.Normal,
      pmFlags: PmFlag.Ducked,
      buttons: 0,
      waterlevel: WaterLevel.None,
      hasGroundEntity: true,
      onLadder: false,
      n64Physics: false,
      origin: ORIGIN,
      mins: MINS,
      maxs: MAXS,
      trace: createTrace({ standBlocked: true }),
    });

    expect(result.ducked).toBe(true);
    expect(result.changed).toBe(false);
  });
});
